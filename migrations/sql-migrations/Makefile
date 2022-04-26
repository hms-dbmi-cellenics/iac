install:
	@python3 -m venv venv
	@venv/bin/pip3 install -r requirements.txt
	@npm ci

migrate-prod-to-dev:
	@python3 dynamo_to_json.py
	@MIGRATION_ENV=development npm run dynamoToSql

migrate-dev-to-dev:
	@ENV=development python3 dynamo_to_json.py
	@SOURCE_ENV=development MIGRATION_ENV=development npm run dynamoToSql

