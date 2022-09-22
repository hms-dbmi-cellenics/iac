set -euo pipefail

# Migrate experiment IDs containing -1 indices

# Issue present between tags:
# * https://github.com/biomage-org/pipeline/releases/tag/0.29.0 [Thu, 25 Aug 2022 14:22:08 GMT]
# * https://github.com/biomage-org/pipeline/releases/tag/0.30.1 [Wed, 14 Sep 2022 10:57:43 GMT]


# Period to download: (2022/08/24, 2022/09/15).

## 0. Requirements

# All the steps require an active tunnel into the desired environment.

# The script relies on the following environment variables
export MIGRATION_ENV=production # use staging for testing
# BIOMAGE_DATA_PATH=... # where do you want the experiments to be downloaded to
export DATA_MIGRATION_PATH=${BIOMAGE_DATA_PATH}/migration_-1

# 1. Compile list of affected experiments

# run the SQL command in the environment
# replace '|' with ',' so it's a csv file
echo "SELECT id, name, created_at, ua.user_id
    FROM experiment e
    INNER JOIN user_access ua
    ON ua.experiment_id  = e.id
    WHERE ua."access_role" = 'owner'
    AND e.pipeline_version  = '2'
    AND e.id IN (
        SELECT experiment_id
        FROM experiment_execution ee
        WHERE last_status_response  @@ '$.qc.stopDate > \"2022-08-24\"'
        AND last_status_response  @@ '$.qc.stopDate < \"2022-09-15\"')"  |
      biomage rds run -i ${MIGRATION_ENV} psql |
      tr '|' ',' > affected_experiments.csv



# **Verify**
# 1. Experiments are downloaded from production, not staging



# use tail to remove headers
# filter the last row which contains row count from SQL
# use awk to select only the first column (ids)
experiment_ids=$(tail -n +3 affected_experiments.csv |
                 egrep -v '\(\d+ rows\)' |
                 awk '{print $1}')


for experiment_id in ${experiment_ids}; do
    ./migrate-single-experiment.sh ${experiment_id}

    echo "Does the migration look good? Press [ENTER] to proceed"
    read -s -N 1 -t 1 key
    if [[ $key != $'\x0a' ]];        # if input == ENTER key
    then
        exit 1
    fi

    # clean downloaded data
    rm -rf ${DATA_MIGRATION_PATH}/${experiment_id}
done
