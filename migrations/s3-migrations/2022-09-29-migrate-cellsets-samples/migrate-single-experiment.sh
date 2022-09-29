#!/bin/bash
# This script needs to be run from within pipeline_runner becuase it needs Seurat

set -euo pipefail


experiment_id=$1
original_pwd=$(pwd)
migration_log_file=${original_pwd}/migration-${MIGRATION_ENV}.log

## Download experiment
echo "[INFO] Downloading ${experiment_id}" | tee -a ${migration_log_file}

biomage experiment download \
    --without_tunnel \
    -e ${experiment_id} \
    -i ${MIGRATION_ENV} \
    -f raw_rds \
    -f cellsets

## 3. Migrate cellsets

echo "[INFO] Migrating cellsets" | tee -a ${migration_log_file}

# Migrate cellsets
Rscript create_sample_cellsets.R ${experiment_id}

echo "[INFO] cellsets migrated" | tee -a ${migration_log_file}

## Upload the resulting files into S3
biomage experiment upload \
    --without_tunnel \
    -e ${experiment_id} \
    -o ${MIGRATION_ENV} \
    -f cellsets

echo "[INFO] Successfully patched ${experiment_id}" | tee -a ${migration_log_file}

# ## 6. Migrate state machines dates and remove state machine for qc
# state_machine_arn=$(echo "select state_machine_arn
# from experiment_execution ee
# where experiment_id = '${experiment_id}' and "pipeline_type" = 'qc'"  |
#       biomage rds run -i ${MIGRATION_ENV} psql |
#       grep 'arn:' |
#       xargs)

# aws stepfunctions delete-state-machine --state-machine-arn ${state_machine_arn}
# echo "[INFO] Deleted state machine ${state_machine_arn} for ${experiment_id}"  | tee -a ${migration_log_file}


# echo "UPDATE experiment_execution SET
# last_status_response = jsonb_set(
#     last_status_response,
#     '{qc}', last_status_response->'qc' || '{\"startDate\": \"2022-09-26T00:00:00.000Z\", \"stopDate\": \"2022-09-26T00:00:00.000Z\"}')
# where experiment_id = '${experiment_id}' and pipeline_type = 'qc'"  |
#       biomage rds run -i ${MIGRATION_ENV} psql

# echo "[INFO] Migrated QC to new date for ${experiment_id}"  | tee -a ${migration_log_file}

# echo "UPDATE experiment_execution SET
# last_status_response = jsonb_set(
#     last_status_response,
#     '{gem2s}', last_status_response->'gem2s' || '{\"startDate\": \"2022-09-26T00:00:00.000Z\", \"stopDate\": \"2022-09-26T00:00:00.000Z\"}')
# where experiment_id = '${experiment_id}' and pipeline_type = 'gem2s'"  |
#       biomage rds run -i ${MIGRATION_ENV} psql

echo "[OK] Migrated ${experiment_id}"  | tee -a ${migration_log_file}

