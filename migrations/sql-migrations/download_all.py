import boto3
import simplejson as json

dynamodb = boto3.resource('dynamodb')
from dynamodb_json import json_util as djson

from datetime import date, datetime

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))


def get_all(tableName):
    table = dynamodb.Table(tableName)

    response = table.scan()
    data = djson.loads(djson.dumps(response['Items']))

    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        data.extend(djson.loads(djson.dumps(response['Items'])))

    return data

def write_to_disk(data, name):
    with open(name, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, default=json_serial)

env = 'production'

tables = ['experiments', 'projects', 'samples', 'user-access', 'invite-access', 'plots-tables']
for table in tables:
    name = f'{table}-{env}'
    print(f'Table {name}')
    experiments = get_all(name)
    write_to_disk(experiments, f'{name}.json')
