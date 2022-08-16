# Running dynamo to SQL migration

### 1. Download data from DynamoDB

You will need to run the Python script, called `dynamo_to_json.py`. The script reads data from all tables in DynamoDB and saves it in `downloaded_data` folder. To run the script, first make sure you are in `migrations/sql-migrations` folder. Then, run the following commands:

```
# If you are running the script for first time, install packages in requirements:
pip3 install -r requirements.txt

python3 dynamo_to_json.py
```

To run the script within a new virtual environment:

```
python3 -m venv my_venv
source my_venv/bin/activate
pip install -r requirements.txt
python dynamo_to_json.py
```
To exit the virtual environment, type `deactivate`.

### 2. Populate sql tables with data from DynamoDB

This is the last part of the migration, which will populate the sql tables of the environment specified by `MIGRATION_ENV` with the data that is in `downloaded_data/` folder, downloaded as part of the previous step.

To do this, run the following commands:

```
npm ci
MIGRATION_ENV=development npm run dynamoToSql
```

If you want to migrate data for `MIGRATION_ENV` that is not equal to development, you will first need to run the `biomage rds tunnel` command (see more in [biomage-utils](https://github.com/hms-dbmi-cellenics/biomage-utils]).


# Migrate users from one AWS account to another

## Create users in target account
To migrate users from one AWS account to another, you first need to create accounts for the users in the target account:

```bash
# AWS profile for target account
export AWS_PROFILE=prod2
biomage account create-users-list --user_list users_to_migrate.csv --input_env production

# add header to output file
sed -i -e '1i"name","email",password"' users_to_migrate.csv.out

# convert output to json
csvtojson users_to_migrate.csv.out > users_to_migrate.json
```

If migrating to local inframock you can manually mock this file:

```json
[{"email":"your@email.net"}]
```

move `users_to_migrate.json` to `migrations/sql-migrations/downloaded_data/aws_to_aws/`.

## Obtain cognito backups for source and target accounts

Next, you will need to get backups for both the source and target cognito user pools. For example:

```bash
export AWS_PROFILE=prod1
node cognito_to_json.js --userPoolId=eu-west-1_abcd1234 --region eu-west-1
```

To migrate an experiment to inframock and view it locally, you need to make sure that the `Username` key in the target backup file is your Cognito id for staging (the user you log in with).

The backup files `eu-west-1_abc123.json` and `us-east-1_def456.json`  will be created in `migrations/sql-migrations/downloaded_data/aws_to_aws/`.

## Setup RDS tunnels

Finally, will need to setup an RDS tunnel for the source and target AWS account. The RDS tunnel to the target account can be skipped for migrations to a local inframock instance. For example:

```bash
# source account tunnel
export AWS_PROFILE=prod1
biomage rds tunnel -i production
```

```bash
# target account tunnel to different local port
export AWS_PROFILE=prod2
biomage rds tunnel -i production -r us-east-1 -lp 5433 -p prod2
```

## Running the migration:

To migration a single experiment from production --> inframock:

```bash
# change this
EXPERIMENT_ID=e0ced9dfd189cc7a83be7e1fe071db3a

npm run migrateUsersToAccount -- \
 --sourceCognitoUserPoolId eu-west-1_abc123 \
 --targetCognitoUserPoolId us-east-1_def456 \
 --usersToMigrateFile test_user.json \
 --experimentsToMigrate $EXPERIMENT_ID \
 --sourceEnvironment production \
 --sourceProfile prod1 
```

To migrate all experiments for specified users from production 1 --> production 2:

```bash
npm run migrateUsersToAccount -- \
 --sourceCognitoUserPoolId eu-west-1_abc123 \
 --targetCognitoUserPoolId us-east-1_def456 \
 --usersToMigrateFile test_user.json \
 --experimentsToMigrate all \
 --sourceEnvironment production \
 --targetEnvironment production \
 --sourceProfile prod1 \
 --targetProfile prod2
```
