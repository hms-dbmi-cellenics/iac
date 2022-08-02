import boto3

s3 = boto3.resource('s3')
s3_client = boto3.client('s3')

from_worker_results_name = "worker-results-staging-242905224710"
to_worker_results_name = "worker-results-test-staging-242905224710"

# Set to False to make the migration actually run
dry_run = True

def experiment_id_with_dashes(old_experiment_id):
  dash_positions = [0,8,12,16,20, None]

  parts = [old_experiment_id[i:j] for i,j in zip(dash_positions, dash_positions[1:])]  
  
  return '-'.join(parts)

def get_new_key(old_key):
  old_experiment_id, *rest_of_key = old_key.split('/')

  if (len(old_experiment_id) != 32):
    return None

  return '/'.join(
    [experiment_id_with_dashes(old_experiment_id), *rest_of_key]
  )

def copy_object(from_bucket, from_key, to_bucket, to_key):
  copy_source = {
    'Bucket': from_bucket,
    'Key': from_key
  }
  
  s3.meta.client.copy_object(copy_source, to_bucket, to_key)

def copy_and_rename_objects():
  # Update keys that depend on the experiment id
  from_bucket_names = [
    "biomage-filtered-cells-staging-242905224710", # key: {experimentId}/{qcStepName}/{hash}.rds
    "biomage-source-staging-242905224710", # key: {experimentId}/r.rds
    "cell-sets-staging-242905224710", # key: {experimentId}
    "processed-matrix-staging-242905224710" # key: {experimentId}/r.rds
  ]

  to_bucket_names = [
    "biomage-filtered-cells-test-staging-242905224710",
    "biomage-source-test-staging-242905224710",
    "cell-sets-test-staging-242905224710",
    "processed-matrix-test-staging-242905224710"
  ]

  for from_bucket_name, to_bucket_name in zip(from_bucket_names, to_bucket_names):
    current_bucket = s3.Bucket(from_bucket_name)
    
    for current_object in current_bucket.objects.all():
      new_key = get_new_key(current_object.key)
      if (new_key == None):
        print(f"[MALFORMED] Skipping {current_object.key}")
        continue
  
      print(f"Setting copy with new name for bucket: {from_bucket_name}, key: {current_object.key}")
      if (not dry_run):
        copy_object(from_bucket_name, current_object.key, to_bucket_name, new_key)

def generate_new_tagging(object):
  # Managing tags is not supported by boto3 resource yet, so use client
  tagging = s3_client.get_object_tagging(Bucket=from_worker_results_name, Key=object.key)
  old_tag_set = tagging["TagSet"]

  old_experiment_id_tag = next((tag for tag in old_tag_set if tag["Key"] == "experimentId"), None)

  if (old_experiment_id_tag == None):
    return None
  
  old_experiment_id_tag["Value"] = experiment_id_with_dashes(old_experiment_id_tag["Value"])

  return tagging

def copy_and_update_tags_worker_results():
  # Update worker-results Etag
  worker_results_bucket = s3.Bucket(from_worker_results_name) # Etag: {experimentId}
  
  for object in worker_results_bucket.objects.all():
    if (not dry_run):
      print(f"Setting copy with same name for bucket: worker_results, key: {object.key}")
      copy_object(from_worker_results_name, object.key, to_worker_results_name, object.key)
    
    new_tagging = generate_new_tagging(object)

    # If there's nothing to update continue
    if (new_tagging == None): 
      continue

    print(f"Updating tags for work result {object.key}")
    if (not dry_run):
      put_tags_response = s3_client.put_object_tagging(
        Bucket=to_worker_results_name,
        Key=object.key,
        Tagging=new_tagging
      )

      print("put_tags_responseDebug")
      print(put_tags_response)

copy_and_rename_objects()
copy_and_update_tags_worker_results()