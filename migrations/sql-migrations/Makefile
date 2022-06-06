SOURCE_ENV=production
TARGET_ENV=development
REDOWNLOAD=false

install:
	@python3 -m venv venv
	@venv/bin/pip3 install -r requirements.txt
	@npm ci

copy-data:
	@echo "Copying data from ${SOURCE_ENV} to ${TARGET_ENV}"
	@if [ "${REDOWNLOAD}" == "true" ]; then\
		venv/bin/python3 dynamo_to_json.py --source-env=${SOURCE_ENV};\
	fi
	@SOURCE_ENV=${SOURCE_ENV} TARGET_ENV=${TARGET_ENV} npm run dynamoToSql

migrate:
	@echo "Migrating database schema for ${TARGET_ENV}"
	@NODE_ENV=${TARGET_ENV} knex migrate:latest

migrate-down:
	@echo "Deleting database schema for ${TARGET_ENV}"
	@NODE_ENV=${TARGET_ENV} knex migrate:down