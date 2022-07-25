# Migration scripts

This directory contains scripts designed to mass-edit experiments, projects, plots,
and other resources found in SQL and S3 to ensure consistent and safe deployments.

### How to use


*NOTE:* These are temporary instructions until a proper workflow is established.

Name all your migration scripts starting with the ISO date string for the time
the script was created in UTC. This is so the files is ordered correctly under an
alphabetical ordering.

### S3 migrations

You will need to link the packages `aws-sdk` and `lodash` into the `s3-migrations` folder:

    cd migrations/s3-migrations/
    npm link aws-sdk lodash

Then simply run your migration with `node`.
