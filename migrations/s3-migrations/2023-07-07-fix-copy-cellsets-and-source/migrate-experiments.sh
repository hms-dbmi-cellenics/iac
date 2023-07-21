#!/bin/bash

# The script relies on the following environment variables
# export MIGRATION_ENV=production
export MIGRATION_ENV=staging
export BIOMAGE_DATA_PATH=./in
export BIOMAGE_DATA_PATH_OUT=./out

download=$1
upload=$2

for experiment_id in $(cat affected-experiment-ids.txt); do
  ./migrate-single-experiment.sh ${experiment_id} ${download} ${upload}
  rm -rf data/${experiment_id}
done
