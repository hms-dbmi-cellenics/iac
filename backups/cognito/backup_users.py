import boto3
import csv
from datetime import datetime
from botocore.exceptions import ClientError
import os

client = boto3.client('cognito-idp')
s3_client = boto3.client('s3')

def backup_users():
    try:
        all_users = get_all_users()
    except Exception as e:
        print('Getting current cognito users has failed ', e)

    csv_headers = ['cognito:username','name','given_name',
    'family_name','middle_name','nickname','preferred_username',
    'profile','picture','website','email','email_verified',
    'gender','birthdate','zoneinfo','locale','phone_number',
    'phone_number_verified','address','updated_at','cognito:mfa_enabled']
    
    with open('data.csv','w', encoding='UTF8') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)

        for user in all_users:
            name = list(filter(lambda attribute: attribute['Name']=='name', user['Attributes']))[0]['Value']
            email = list(filter(lambda attribute: attribute['Name']=='email', user['Attributes']))[0]['Value']
            email_verified = list(filter(lambda attribute: attribute['Name']=='email_verified', user['Attributes']))[0]['Value']
            
            new_row = [email,name,'','','','','','','','',email,email_verified,'','','','','','FALSE','','','FALSE']
            writer.writerow(new_row)
            file_name = '{}/biomage-userpool-case-insensitive-production/data.csv'.format(datetime.now().isoformat())
    try:
        s3_client.upload_file('data.csv', 'biomage-backups-production', file_name)
        #removing the local file after saving to S3
        os.remove('data.csv')
    except ClientError as e:
        print('Uploading backup to S3 has failed ', e)
    
def get_all_users():
    cognito = boto3.client('cognito-idp')
    
    users = []
    next_page = None
    kwargs = {
        # users-insensitive-production pool
        'UserPoolId': 'eu-west-1_eYTCV3Nl7',
        'AttributesToGet': ['email', 'email_verified', 'name']
    }

    users_remain = True
    while(users_remain):
        if next_page:
            kwargs['PaginationToken'] = next_page
        response = cognito.list_users(**kwargs)
        users.extend(response['Users'])
        next_page = response.get('PaginationToken', None)
        users_remain = next_page is not None

    return users

backup_users()