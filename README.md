Deployment
==========

Before deploying to a new environment, a service account needs to be created in that environment.
The file for that is found in the [iac](https://gitlab.com/biomage/iac/-/blob/master/k8s_configs/worker-access-service-account.yaml) repu under `k8s_configs/worker-access-service-account.yaml`. **Be mindful** of the namespace you are applying the file to.

This is because GitLab uses a separate deploy user for each environment, so the API cannot, by itself, be deployed with a custom service account granting privileges to launch jobs in another environment.

There is a `chart/` directory, which is a one-to-one copy of the default deployment chart supplied by GitLab, **except** that the service account we created above is automatically bound to the deployment, so it can manage jobs.

This will need to be automated and simplified in due course.

Local development
=================

You can use InfraMock to develop locally. To do so, make sure you have InfraMock set up and running
in the background. You should be able to simply start the API and it should default to the local InfraMock
instance, which should have Redis as well as all the mocked AWS services ready for use.

To use a **live** (`staging` or `production`) cluster, make sure you run the API with the `CLUSTER_ENV` environment
variable set to the appropriate value.

### 2. Start the API
Run `yarn start` to run the API locally, while running Redis from the previous step on a separate terminal tab.
There will be initially a cache error, but after that you should see message saying `connected`.

### 3. Run the UI locally
On a separate terminal inside the UI project, run `yarn start` to start the UI locally. After the UI is launched,
any request from the UI will be automatically forwarded to the API.

### 4. Receive responses back from the worker
This is only possible if you run InfraMock for local development. This is because the live SNS topic cannot push
messages to a local development machine, only to an endpoint exposed to the internet.

You can simply run the worker locally as well, in which case results processed by the worker will automatically get
pushed to the SNS topic the API is configured to listen to.

If you want to test a custom response that you wrote yourself, you can use `aws-cli` pointed to the InfraMock endpoint.
Then you can push mocked worker responses as follows:

        aws --endpoint-url=http://localhost:4566 sns publish --topic-arn arn:aws:sns:eu-west-2:000000000000:work-results-development --message "$(< payload.json)"

from the file `payload.json`.