DynamoDB migration scripts
==========================

This directory contains scripts designed to mass-edit experiments, projects, plots,
and other resources found in DynamoDB to ensure consistent and safe deployments.

How to use
----------

*NOTE:* These are temporary instructions until a proper workflow is established.

Name all your migration scripts starting with the ISO date string for the time
the script was created in UTC. This is so the files is ordered correctly under an
alphabetical ordering.

You will need to install the tool [dynamodb-migrations](https://www.npmjs.com/package/dynamodb-migrations)

You will need to link the package `dyno` into the `dynamodb-migrations` folder:

    cd dynamodb_migrations/
    npm link dyno

Then, run the following to test the script in dry run:

    K8S_ENV=staging dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno
    K8S_ENV=production dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno

If it works, you can deploy it by appending the `--live` flag:

    K8S_ENV=staging dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno --live
    K8S_ENV=production dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno --live
