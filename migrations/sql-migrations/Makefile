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
	@SOURCE_ENV=${SOURCE_ENV} MIGRATION_ENV=${MIGRATION_ENV} npm run dynamoToSql