import sys
import boto3
from datetime import datetime
import hashlib
import json
from collections import OrderedDict

### Background
# This is a migration for PR 408 - Fix sample order moves storage of samples from projects to experiments.

print("""
    This script contains bugs with causes old data to not be migrated. This script is 
    amended with the new script`2021-10-15T17:30:00Z-update-old-experiment-gem2s-params.py` 
    in the migrations folder
    """)
sys.exit()

# Insert endpoint_url='http://localhost:4566' as the 2nd param to test with localstack
client = boto3.client('dynamodb')

environment = 'production'

experiments_table = f'experiments-{environment}'
projects_table = f'projects-{environment}'
samples_table = f'samples-{environment}'

experiments = client.scan(
    TableName=experiments_table,
    ProjectionExpression="experimentId, createdAt, projectId",
)['Items']

## >> Uncomment lines below to test with a single experiment
# test_experiment_id = "e958cce5442c27fc325a9e8fd092d3cc"

# experiments = client.get_item(
#     TableName=experiments_table,
#     Key={"experimentId": { "S" : test_experiment_id }},
#     ProjectionExpression="experimentId, createdAt, projectId"
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

    try:
        experiment_id = experiment['experimentId']
        print(f"\n=========")
        print(f"Preparing migration for experiment {experiment_id['S']}")

        if not experiment.get('createdAt') : print('Project does not contain createdAt, inserting current timestamp')
        created_date = experiment['createdAt'] if experiment.get('createdAt') else { "S" : datetime.now().isoformat() }

        if not experiment.get('projectId') : raise Exception('Experiment does not have associated project')
        project_id = experiment['projectId']

        project = client.get_item(
            TableName=projects_table,
            Key={"projectUuid" : project_id },
            ProjectionExpression="projects"
        )

        if not project.get('Item') : raise Exception('Project does not exist')
        samples = project['Item']['projects']['M']['samples']
        
        if not samples.get('L') : raise Exception('Project does not contain samples')

        # Get variables
        print("calculating new GEM2S hash...")
        experiment_record = client.get_item(
            TableName=experiments_table,
            Key={"experimentId": experiment_id }
        )['Item']

        project_record = project['Item']['projects']

        samples_record = client.get_item(
            TableName=samples_table,
            Key={"experimentId": experiment_id }
        )['Item']['samples']

        hash_params = create_gem2s_hash(experiment_record, project_record, samples_record)

        print("inserting values...")
        client.update_item(
            TableName=experiments_table,
            Key={"experimentId": experiment_id},
            UpdateExpression="SET createdDate = :createdDate, sampleIds = :samples, meta.gem2s.paramsHash = :hashParams",
            ExpressionAttributeValues={ 
                ":createdDate" : created_date,
                ":samples" : samples,
                ":hashParams" : { "S" : hash_params }
            },
        )

        print(f"Experiment {experiment_id['S']} migrated succesfully.")

    except Exception as e:
        # print skipping inserting experiment id
        print(f"Skipping migration of {experiment['experimentId']['S']} : {e}")