set -euo pipefail

# Migrate experiment IDs containing -1 indices

# Issue present between tags:
# * https://github.com/biomage-org/pipeline/releases/tag/0.29.0 [Thu, 25 Aug 2022 14:22:08 GMT]
# * https://github.com/biomage-org/pipeline/releases/tag/0.30.1 [Wed, 14 Sep 2022 10:57:43 GMT]


# Period to download: (2022/08/24, 2022/09/15).


## 0. Requirements

# All the steps require an active tunnel into the desired environment.

# The script relies on the following environment variables
MIGRATION_ENV=staging # use staging for testing
# BIOMAGE_DATA_PATH=... # where do you want the experiments to be downloaded to
DATA_MIGRATION_PATH=${BIOMAGE_DATA_PATH}/migration_-1

# 1. Compile list of affected experiments

# run the SQL command in the environment
# replace '|' with ',' so it's a csv file
echo "SELECT id, name, created_at
      FROM experiment e
      WHERE  e.created_at > '2022-08-24' AND
             e.created_at < '2022-09-15' AND
             e.pipeline_version = 2 AND
             e.id IN (SELECT experiment_id FROM experiment_execution)
      ORDER BY e.created_at"  |
      biomage rds run -i ${MIGRATION_ENV} psql |
      tr '|' ',' > affected_experiments.csv



# **Verify**
# 1. Experiments are downloaded from production, not staging
# 2. The number of experiments downloaded is 204
# 3. Check that the `created_at` column corresponds to the correct period.


## 2. Download affected experiments:


# use tail to remove headers
# filter the last row which contains row count from SQL
# use awk to select only the first column (ids)
experiment_ids=$(tail -n +3 affected_experiments.csv |
                 egrep -v '\(\d+ rows\)' |
                 awk '{print $1}')


# Enable to migrate all experiments
# for experiment_id in $(echo $experiment_ids); do


biomage experiment download \
    -e ${experiment_id} \
    -i ${MIGRATION_ENV} \
    -o ${DATA_MIGRATION_PATH}/${experiment_id} \
    -f raw_rds \
    -f processed_rds \
    -f cellsets


## 3. Check how many experiments contain -1s


cd ${DATA_MIGRATION_PATH}/${experiment_id}

# verify that cell sets contain a -1
if [ "$(grep -v ',-1' cellsets.json)" != "" ]; then
    echo '[SKIP]: ${experiment_id} cellsets does not contain -1';
fi

# This step is not needed because the -1 might have been filtered out
# verify that processed_r.rds file contains -1
# if [ "$(R -e 'any(readRDS("processed_r.rds")$cells_id == -1)' | grep FALSE)" != "" ]; then
#     echo '[SKIP]: ${experiment_id} processed_r does not contain -1';
# fi

# needed to iterate over folders/filenames with spaces
SAVEIFS=$IFS
IFS=$(echo -en "\n\b")

# check that one raw sample file contains -1
exists_wrong_sample=false
for sample in $(ls raw); do
    if [ "$(R -e 'any(readRDS("raw/'${sample}'")$cells_id == -1)' | grep TRUE)" != "" ]; then
        exists_wrong_sample=true
    fi
done

if [ "${exists_wrong_sample}" != "true" ]; then
    echo "[SKIP]: ${experiment_id} raw samples do not contain -1";
fi

# 4. Migrate files to stop using -1

# Migrate processed RDS
mv processed_r.rds processed_r.rds.orig
R -e 'data <- readRDS("processed_r.rds.orig")
      data$cells_id <- data$cells_id+1
      saveRDS(data, "processed_r.rds")'

# Migrate raw samples RDS
for sample in $(ls raw/*.rds); do
    mv "${sample}" "${sample}.orig"
    R -e 'data <- readRDS("'${sample}'.orig")
      data$cells_id <- data$cells_id+1
      saveRDS(data, "'${sample}'")'
done

# Migrate cellsets
python3 cellsets-patch.py


# 5. Check that the results do not contain -1s

# verify that cell sets contain do not contain -1
if [ "$(grep ',-1' cellsets.json)" != "" ]; then
    echo "[FAIL]: ${experiment_id} cellsets still contain -1"
fi

# verify that processed_r.rds file does not contain -1
if [ "$(R -e 'any(readRDS("processed_r.rds")$cells_id == -1)' | grep FALSE)" = "" ]; then
    echo "[FAIL]: ${experiment_id} processed_r still contain -1"
fi


# check that raw samples file do not contain -1
exists_wrong_sample=false
for sample in $(ls raw/*.rds); do
    if [ "$(R -e 'any(readRDS("'${sample}'")$cells_id == -1)' | grep TRUE)" != "" ]; then
        exists_wrong_sample=true
    fi
done

if [ "${exists_wrong_sample}" = "true" ]; then
    echo "[FAIL]: ${experiment_id} raw samples still contain -1"
fi


to_upload_experiment_id=2a22bbfe-bb07-407e-8bb5-f3e9aac0b943
# upload the resulting files into S3
biomage experiment upload \
    -e ${experiment_id} \
    -o ${MIGRATION_ENV} \
    -i ${DATA_MIGRATION_PATH}/${experiment_id} \
    -f raw_rds \
    -f processed_rds \
    -f cellsets

# done