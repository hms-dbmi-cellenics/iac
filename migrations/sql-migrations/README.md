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
