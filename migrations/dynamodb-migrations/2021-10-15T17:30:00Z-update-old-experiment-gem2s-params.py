import sys
import boto3
from datetime import datetime
import hashlib
import json
from collections import OrderedDict

### Background
# This is a new script to ammmend script `2021-08-04T10:06:50Z-migrate-sampleids-to-experiment.py`

# Insert endpoint_url='http://localhost:4566' as the 2nd param to test with localstack
client = boto3.client('dynamodb')

environment = 'production'

experiments_table = f'experiments-{environment}'
projects_table = f'projects-{environment}'
samples_table = f'samples-{environment}'


experiments = []

results = client.scan(
    TableName=experiments_table,
    ProjectionExpression="experimentId, createdAt, createdDate, projectId, meta",
)

experiments = results['Items']

while results.get('LastEvaluatedKey', False):
  results = client.scan(
    TableName=experiments_table,
    ProjectionExpression="experimentId, createdAt, createdDate, projectId, meta",
    ExclusiveStartKey=results['LastEvaluatedKey']
  )

  experiments += results['Items']

# >> Uncomment lines below to test with a single experiment
# test_experiment_id = "056076b4a6c6abec9f59989674532011"

# experiments = client.get_item(
#     TableName=experiments_table,
#     Key={"experimentId": { "S" : test_experiment_id }},
#     ProjectionExpression="experimentId, createdAt, projectId, meta.gem2s.paramsHash"
# )['Item']
# experiments = [experiments]

## << Uncomment lines above to test

# function to create gem2s hash
def create_gem2s_hash(experiment, project, samples):

    organism = None # default value

    if experiment['meta']['M']['organism'].get('S'):
        organism = experiment['meta']['M']['organism']['S']

    # Filter 'ids' key which is present in older samples object
    unsorted_sample_ids = [sample_id for sample_id in samples['M'] if sample_id != 'ids']

    # Sample IDS is first sorted so that hash does not depend on order of samples
    sorted_sample_ids = unsorted_sample_ids.copy()
    sorted_sample_ids.sort()

    sample_names = []
    # Sample names are created according to the sorted sampleIds so sample order doesn't matter
    for sample_id in sorted_sample_ids:
        sample_names.append(samples['M'][sample_id]['M']['name']['S'])

    input_type = experiment["meta"]['M']["type"].get('S', '10x')

    hash_params = OrderedDict()
    
    hash_params = {
        "organism": organism,
        "input": {"type" : input_type},
        "sampleIds": sorted_sample_ids,
        "sampleNames": sample_names,
    }

    metadata_values = OrderedDict()

    metadata_keys = [metadata['S'] for metadata in project['M']['metadataKeys']['L']]

    if len(project['M']['metadataKeys']['L']) > 0:

        for key in metadata_keys:
            # Replace '-' in key to '_'if
            sanitizedKey = key.replace('-', '_')

            for sample_id in unsorted_sample_ids:

                metadata_value = "N.A." # default metadata value

                if samples['M'][sample_id]['M']['metadata']['M'].get(key):
                    metadata_value = samples['M'][sample_id]['M']['metadata']['M'][key]['S']

                if not metadata_values.get(sanitizedKey):
                    metadata_values[sanitizedKey] = []    

                metadata_values[sanitizedKey].append(metadata_value)

        hash_params['metadata'] = metadata_values

    hash_params_string = json.dumps(hash_params).replace(", ", ",").replace(": ", ":").encode('utf-8')

    return hashlib.sha1(hash_params_string).hexdigest()


print(f"=== Doing migration for PR 408 ===")

for experiment in experiments:

    # try:
    experiment_id = experiment['experimentId']
    print(f"\nExp: {experiment_id['S']}")

    # This inserts a new createdDate property for old experiments.
    # New experiments do not have createdAt, so it will always show this error.
    created_date = experiment['createdAt'] if experiment.get('createdAt') else { "S" : datetime.now().isoformat() }
    if not experiment.get('createdDate') : 
      print('Project does not contain createdDate, inserting current timestamp')
      client.update_item(
        TableName=experiments_table,
        Key={"experimentId": experiment_id},
        UpdateExpression="SET createdDate = :createdDate",
        ExpressionAttributeValues={ 
            ":createdDate" : created_date,
        },
    )

    if not experiment.get('projectId') : 
      print('Experiment does not have associated project')
      continue
    project_id = experiment['projectId']

    project = client.get_item(
        TableName=projects_table,
        Key={"projectUuid" : project_id },
        ProjectionExpression="projects"
    )

    if not project.get('Item') :
      print('Project does not exist')
      continue
    samples = project['Item']['projects']['M']['samples']
    
    if not samples.get('L') : 
      print('Project does not contain samples')
      continue

    # Get variables
    experiment_record = client.get_item(
        TableName=experiments_table,
        Key={"experimentId": experiment_id }
    )['Item']

    project_record = project['Item']['projects']

    # Some broken projects do not have samples in the samples table
    try :
      samples_record = client.get_item(
          TableName=samples_table,
          Key={"experimentId": experiment_id }
      )['Item']['samples']
    except KeyError :
      continue

    # Some experiments do not have a GEM2S hash
    try:
      old_hash = experiment['meta']['M']['gem2s']['M']['paramsHash']['S']
    except KeyError:
      print(f"No meta GEM2S hash")
      continue
    
    if 'organism' not in experiment['meta']['M']:
      print("No organism in meta")
      continue

    new_hash = create_gem2s_hash(experiment_record, project_record, samples_record)

    createdAt = None
    createdDate = None

    if experiment.get('createdAt'):
      createdAt = experiment['createdAt']['S']

    if experiment.get('createdDate'):
      createdDate = experiment['createdDate']['S']

    if not old_hash == new_hash:
        
        print(f"createdDate: {createdDate}, createdAt: {createdAt} paramsHash [OLD, NEW]: {old_hash}, {new_hash}")

        client.update_item(
            TableName=experiments_table,
            Key={"experimentId": experiment_id},
            UpdateExpression="SET createdDate = :createdDate, sampleIds = :samples, meta.gem2s.paramsHash = :hashParams",
            ExpressionAttributeValues={ 
                ":createdDate" : created_date,
                ":samples" : samples,
                ":hashParams" : { "S" : new_hash }
            },
        )