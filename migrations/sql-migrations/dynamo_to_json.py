import os
import sys
import getopt
import boto3
import simplejson as json

from dynamodb_json import json_util as djson

from datetime import date, datetime

DATA_FOLDER = 'downloaded_data'
DEV_ENDPOINT_URL = 'http://localhost:4566'

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))


def get_all(dynamodb, tableName):
    table = dynamodb.Table(tableName)

    response = table.scan()
    data = djson.loads(djson.dumps(response['Items']))

    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        data.extend(djson.loads(djson.dumps(response['Items'])))

    return data

def write_to_disk(data, name):

    if not os.path.exists(DATA_FOLDER):
        os.makedirs(DATA_FOLDER)

    with open(name, 'w+', encoding='utf-8') as f:
        json.dump(data, f, indent=4, default=json_serial)

def main(argv):

    source_env = 'production'

    opts, remainder = getopt.getopt(argv,"e:",["source_env="])

    for opt, arg in opts:
        if opt in ("-e", "--source_env"):
            source_env = arg

    endpoint_url = DEV_ENDPOINT_URL if source_env == 'development' else None
    dynamodb = boto3.resource('dynamodb', endpoint_url=endpoint_url)

    print(f'Download {source_env} dynamoDB tables into JSON.')
    tables = ['experiments', 'projects', 'samples', 'user-access', 'invite-access', 'plots-tables']
    for table in tables:
        name = f'{table}-{source_env}'
        print(f'Table {name}')
        experiments = get_all(dynamodb, name)
        write_to_disk(experiments, f'{DATA_FOLDER}/{name}.json')

if __name__ == "__main__":
    main(sys.argv[1:])