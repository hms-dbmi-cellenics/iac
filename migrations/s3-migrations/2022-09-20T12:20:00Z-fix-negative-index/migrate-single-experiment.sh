#!/bin/bash

set -euo pipefail


experiment_id=$1

biomage experiment download \
    -e ${experiment_id} \
    -i ${MIGRATION_ENV} \
    -o ${DATA_MIGRATION_PATH}/${experiment_id} \
    -f raw_rds \
    -f processed_rds \
    -f cellsets \
    -f filtered_cells

exit 1
## 3. Check how many experiments contain -1s


cd ${DATA_MIGRATION_PATH}/${experiment_id}

# verify that cell sets contain a -1
if [ "$(grep -v ',-1' cellsets.json)" != "" ]; then
    echo '[SKIP]: ${experiment_id} cellsets does not contain -1';
    exit 1
fi

# needed to iterate over folders/filenames with spaces
SAVEIFS=$IFS
IFS=$(echo -en "\n\b")

# check that one raw sample file contains -1
exists_wrong_sample=false
for sample in $(ls raw/*rds); do
    if [ "$(R -e 'any(readRDS("'${sample}'")$cells_id == -1)' | grep TRUE)" != "" ]; then
        exists_wrong_sample=true
    fi
done

if [ "${exists_wrong_sample}" != "true" ]; then
    echo "[SKIP]: ${experiment_id} raw samples do not contain -1";
    exit 1
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
      saveRDS(data, "'${sample}'", compress = FALSE)'
done

# Migrate cellsets
python3 /Users/ahriman/repos/github.com/biomage-ltd/iac/migrations/s3-migrations/2022-09-20T12:20:00Z-fix-negative-index/cellsets-patch.py

# Migrate filtered cells
for sample in $(ls filtered-cells/*/*.rds); do
    mv "${sample}" "${sample}.orig"
    R -e 'data <- readRDS("'${sample}'.orig")
      data <- lapply(data, `+`, 1)
      saveRDS(data, "'${sample}'")'
done
# 5. Check that the results do not contain -1s

# verify that cell sets contain do not contain -1
if [ "$(grep ',-1' cellsets.json)" != "" ]; then
    echo "[FAIL]: ${experiment_id} cellsets still contain -1"
    exit 1
fi

# verify that processed_r.rds file does not contain -1
if [ "$(R -e 'any(readRDS("processed_r.rds")$cells_id == -1)' | grep FALSE)" = "" ]; then
    echo "[FAIL]: ${experiment_id} processed_r still contain -1"
    exit 1
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
    exit 1
fi


# to_upload_experiment_id=2a22bbfe-bb07-407e-8bb5-f3e9aac0b943
# upload the resulting files into S3
biomage experiment upload \
    -e ${experiment_id} \
    -o ${MIGRATION_ENV} \
    -i ${DATA_MIGRATION_PATH}/${experiment_id} \
    -f raw_rds \
    -f processed_rds \
    -f cellsets \
    -f filtered_cells

# done

echo "[OK] Successfully patched ${experiment_id}"