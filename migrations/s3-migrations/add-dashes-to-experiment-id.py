import boto3

from threading import Thread
from time import perf_counter

import asyncio
import concurrent.futures

from timeit import default_timer as timer

# Set to False to make the migration actually run
dry_run = True

s3 = boto3.resource('s3')
s3_client = boto3.client('s3')

max_workers_size=50

# executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers_size)

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
  
  try:
    s3.meta.client.copy(CopySource=copy_source, Bucket=to_bucket, Key=to_key)
  except Exception as e:
    print(f"[ERROR] {e}")

  print(f"[FINISHED] bucket: {to_bucket}, key: {to_key}")

async def copy_and_rename_in_bucket(from_bucket_name, to_bucket_name, max_workers_for_bucket):
  current_bucket = s3.Bucket(from_bucket_name)
  
  blocking_tasks = []

  executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers_for_bucket)

  loop = asyncio.get_event_loop()

  for current_object in current_bucket.objects.all():
    new_key = get_new_key(current_object.key)
    if (new_key == None):
      print(f"[MALFORMED] Skipping {current_object.key}")
      continue

    print(f"Setting copy with new name for bucket: {from_bucket_name}, key: {current_object.key}")
    if (not dry_run):
      blocking_tasks.append(loop.run_in_executor(executor, copy_object, from_bucket_name, current_object.key, to_bucket_name, new_key))

  completed, pending = await asyncio.wait(blocking_tasks)
  results = [t.result() for t in completed]

  print(f"[BATCH_FINISHED], copied {len(results)} objects")

  return results

def copy_and_rename_objects():
  # Update keys that depend on the experiment id
  from_bucket_names = [
    "biomage-source-staging-160782110667", # key: {experimentId}/r.rds
    "biomage-filtered-cells-staging-160782110667", # key: {experimentId}/{qcStepName}/{hash}.rds
    "cell-sets-staging-160782110667", # key: {experimentId}
    "processed-matrix-staging-160782110667" # key: {experimentId}/r.rds
  ]

  to_bucket_names = [
    ("biomage-source-staging-160782110667", 10),
    ("biomage-filtered-cells-staging-160782110667", 50),
    ("cell-sets-staging-160782110667", 50),
    ("processed-matrix-staging-160782110667", 10)
  ]
  
  event_loop = asyncio.get_event_loop()

  all_start = timer()
  for from_bucket_name, (to_bucket_name, max_workers_for_bucket) in zip(from_bucket_names, to_bucket_names):
    start = timer()
    non_blocking_results = event_loop.run_until_complete(copy_and_rename_in_bucket(from_bucket_name, to_bucket_name, max_workers_for_bucket))
    elapsed = (timer() - start)
    print(f"{from_bucket_name}. Time: {elapsed} elapsed. #objects copied: {len(non_blocking_results)}")

  all_elapsed = (timer() - all_start)
  print(f"[DONE]. Time: {all_elapsed}")
  
from_worker_results = "worker-results-staging-160782110667"
to_worker_results = "worker-results-staging-160782110667"

def generate_new_tagging(object):
  
  # Managing tags is not supported by boto3 resource yet, so use client
  tagging = s3_client.get_object_tagging(Bucket=from_worker_results, Key=object.key)
  old_tag_set = tagging["TagSet"]

  old_experiment_id_tag = next((tag for tag in old_tag_set if tag["Key"] == "experimentId"), None)

  if (old_experiment_id_tag == None):
    return None
  
  old_experiment_id_tag["Value"] = experiment_id_with_dashes(old_experiment_id_tag["Value"])

  tagging.pop("ResponseMetadata", None)
  return tagging

async def copy_and_update_tags_worker_results():
  # Update worker-results Etag
  worker_results_bucket = s3.Bucket(from_worker_results) # Etag: {experimentId}
  
  executor = concurrent.futures.ThreadPoolExecutor(max_workers=50)

  loop = asyncio.get_event_loop()
  blocking_tasks = []

  for object in worker_results_bucket.objects.all():
    if (not dry_run):
      print(f"Setting copy with same name for bucket: worker_results, key: {object.key}")
      blocking_tasks.append(loop.run_in_executor(executor, copy_object, from_worker_results, object.key, to_worker_results, object.key))

      # copy_object(from_worker_results, object.key, to_worker_results, object.key)
      print(f"[FINISHED] {worker_results_bucket}, key: {object.key}")


  for object in worker_results_bucket.objects.all():
    new_tagging = generate_new_tagging(object)

    # If there's nothing to update continue
    if (new_tagging == None): 
      continue

    print(f"Updating tags for work result {object.key}")
    if (not dry_run):
      put_tags_response = s3_client.put_object_tagging(
        Bucket=to_worker_results,
        Key=object.key,
        Tagging=new_tagging
      )

copy_and_rename_objects()

event_loop = asyncio.get_event_loop()
event_loop.run_until_complete(copy_and_update_tags_worker_results())