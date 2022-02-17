import boto3
import csv
from datetime import datetime
from botocore.exceptions import ClientError
import os

client = boto3.client('cognito-idp')
s3_client = boto3.client('s3')

environment='production'
user_pool_name = 'biomage-user-pool-case-insensitive-{}'.format(environment)
backup_bucket = 'biomage-backups-{}'.format(environment)

def backup_users():
    try:
        all_users = get_all_users()
        num_users = len(all_users)
    except Exception as e:
        raise Exception('Getting current cognito users has failed ', e)

    csv_headers = ['cognito:username','name','email','email_verified',
    'cognito:mfa_enabled','phone_number_verified',
    'given_name','family_name','middle_name','nickname','preferred_username',
    'profile','picture','website',
    'gender','birthdate','zoneinfo','locale','phone_number',
    'address','updated_at', 'custom:institution']
    
    with open('data.csv','w', encoding='UTF8') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        lines_written = 0

        for user in all_users:
            name = list(filter(lambda attribute: attribute['Name']=='name', user['Attributes']))[0]['Value']
            email = list(filter(lambda attribute: attribute['Name']=='email', user['Attributes']))[0]['Value']
            email_verified = list(filter(lambda attribute: attribute['Name']=='email_verified', user['Attributes']))[0]['Value']
            
            new_row = [email,name,email,email_verified,'FALSE','FALSE','','','','','','','','','','','','','','','']
            writer.writerow(new_row)
            lines_written += 1
        
        if lines_written != num_users:
            raise Exception('Number of lines written does not match number of users in cognito')

    try:
        file_name = '{}/{}/data.csv'.format(datetime.now().isoformat(), user_pool_name)
        s3_client.upload_file('data.csv', backup_bucket, file_name)
        #removing the local file after saving to S3
        os.remove('data.csv')
    except ClientError as e:
        raise Exception('Uploading backup to S3 has failed ', e)
    
def get_all_users():
    user_pools = client.list_user_pools(
    MaxResults=10,   
    )['UserPools']
    user_pool_id = list(filter(lambda user_pool: user_pool['Name']==user_pool_name, user_pools))[0]['Id']

    users = []
    next_page = None
    kwargs = {
        'UserPoolId': user_pool_id,
        'AttributesToGet': ['email', 'email_verified', 'name']
    }

    users_remain = True
    while(users_remain):
        if next_page:
            kwargs['PaginationToken'] = next_page
        response = client.list_users(**kwargs)
        users.extend(response['Users'])
        next_page = response.get('PaginationToken', None)
        users_remain = next_page is not None
    return users

backup_users()