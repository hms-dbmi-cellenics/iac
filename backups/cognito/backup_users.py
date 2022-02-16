import boto3
client = boto3.client('cognito-idp')

# def backup_users():
#     response = client.get_csv_header(
#     UserPoolId='eu-west-1_eYTCV3Nl7'
#     )
#     #cognito:username,name,given_name,family_name,middle_name,nickname,preferred_username,profile,picture,website,email,email_verified,gender,birthdate,zoneinfo,locale,phone_number,phone_number_verified,address,updated_at,cognito:mfa_enabled
    
#     users_resp = client.list_users (
#             UserPoolId = 'eu-west-1_eYTCV3Nl7',
#             AttributesToGet = ['email', 'email_verified', 'name',])
#     print('hi', len(users_resp['Users']))
def backup_users():
    all_users = get_all_users()
    csv_headers = ['cognito:username','name','given_name',
    'family_name','middle_name','nickname','preferred_username',
    'profile','picture','website','email','email_verified',
    'gender','birthdate','zoneinfo','locale','phone_number',
    'phone_number_verified','address','updated_at','cognito:mfa_enabled']
    csv_data = []
    with open('data.csv','w', encoding='UTF8') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        for user in all_users:
            const name = filter(lambda field: score >= 70, user)
            name = 
            const data = [user['Username'], ]



def get_all_users():
    cognito = boto3.client('cognito-idp')
    
    users = []
    next_page = None
    kwargs = {
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

    print('USERS ARE ', users[0])
    return users
    # {"Username":"00db34d7-5058-413b-b550-5f3fb4cdc5cc",
    # "Attributes":[{"Name":"sub","Value":"00db34d7-5058-413b-b550-5f3fb4cdc5cc"},
    # {"Name":"email_verified","Value":"true"},{"Name":"name","Value":"Pawel Herzyk"},
    # {"Name":"email","Value":"pawel.herzyk@glasgow.ac.uk"}],
    # "UserCreateDate":"2021-12-22T11:31:23.389Z","UserLastModifiedDate":"2022-01-03T10:41:11.718Z","Enabled":true,"UserStatus":"CONFIRMED"}

    # {'UserPoolId': 'eu-west-1_eYTCV3Nl7', 
    # 'CSVHeader': ['name', 'given_name', 'family_name', 'middle_name', 
    # 'nickname', 'preferred_username', 'profile', 'picture', 'website', 'email', 
    # 'email_verified', 'gender', 'birthdate', 'zoneinfo', 'locale', 'phone_number', 
    # 'phone_number_verified', 'address', 'updated_at', 'custom:institution',
    #  'cognito:mfa_enabled', 'cognito:username'], \
    # 'ResponseMetadata': {'RequestId': '296b8af3-79cd-4f01-83b6-76625f001499', 
    # 'HTTPStatusCode': 200, 'HTTPHeaders': {'date': 'Wed, 16 Feb 2022 11:39:08 GMT', 
    # 'content-type': 'application/x-amz-json-1.1', 'content-length': '350', 
    # 'connection': 'keep-alive', 'x-amzn-requestid': '296b8af3-79cd-4f01-83b6-76625f001499'
    # }, 'RetryAttempts': 0}}

get_all_users()