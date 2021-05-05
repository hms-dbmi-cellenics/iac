DynamoDB migration scripts
==========================

This directory contains scripts designed to mass-edit experiments, projects, plots,
and other resources found in DynamoDB to ensure consistent and safe deployments.

Useful information
------------------

* The workflow below is completely manual. An automatic, CI-based workflow is in the works, so this is a temporary
solution. Scripts should be submitted as a merge request and inspected before performing the manual workflow below.

* This workflow provides no rollbacks. Make sure you test on a local environment first. You can edit the configuration
per the `dynamodb-migration` docs to attach this to a custom AWS endpoint like Inframock. See the `README` in the root
of this repository to see how that is done.

* The dry-run functionality is quite limited. It does not allow you to perform any AWS queries, as the DynamoDB connection
(named `dyno`) is not passed in for dry runs. You are, however, given each record that will be modified as a JavaScript
object, which you can use to perform some tests.


How to use
----------

*NOTE:* These are temporary instructions until a proper workflow is established.

Name all your migration scripts starting with the ISO date string for the time
the script was created in UTC. This is so the files is ordered correctly under an
alphabetical ordering.

You will need to install the tool [dynamodb-migrations](https://www.npmjs.com/package/dynamodb-migrations).
This is a global tool that exposes the `dynamodb-migrate` command.

You will need to link the package `dyno` into the `dynamodb-migrations` folder:

    cd dynamodb_migrations/
    npm link dyno

Then, run the following to test the script in dry run (no `--live` flag supplied means a dry run is being performed):

    K8S_ENV=staging dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno
    K8S_ENV=production dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno

If it works, you can deploy it by appending the `--live` flag:

    K8S_ENV=staging dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno --live
    K8S_ENV=production dynamodb-migrate scan eu-west-1/TABLE_NAME ./dynamodb-migrations/SCRIPT_NAME.js --dyno --live

