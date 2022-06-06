
old_buckets=("plots-tables" "cell-sets" "worker-results" "processed-matrix" "biomage-pipeline-debug" "biomage-source" "biomage-filtered-cells" "biomage-backups" "biomage-originals" "biomage-public-datasets") 
environments=("staging" "production")
accound_id="242905224710"

for environment in ${environments[@]}; do
  for bucket in ${old_buckets[@]}; do
    bucket_name="${bucket}-${environment}"
    new_bucket_name="${bucket}-${environment}-${accound_id}"
    echo "--------- migrating $bucket_name to $new_bucket_name ---------"

    aws s3 sync s3://${bucket_name} s3://${new_bucket_name}
  done
done
