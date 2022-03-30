# How to download data from DynamoDB

You will need to run the Python script, called `dynamo_to_json.py`. The script reads data from all tables in DynamoDB and saves it in `downloaded_data` folder. To run the script, first make sure you are in `migrations/sql-migrations` folder. 

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