api
===

Deployment
----------

Before deploying to a new environment, a service account needs to be created in that environment.
The file for that is found in the [iac](https://gitlab.com/biomage/iac/-/blob/master/k8s_configs/worker-access-service-account.yaml) repu under `k8s_configs/worker-access-service-account.yaml`. **Be mindful** of the namespace you are applying the file to.

This is because GitLab uses a separate deploy user for each environment, so the API cannot, by itself, be deployed with a custom service account granting privileges to launch jobs in another environment.

There is a `chart/` directory, which is a one-to-one copy of the default deployment chart supplied by GitLab, **except** that the service account we created above is automatically bound to the deployment, so it can manage jobs.

This will need to be automated and simplified in due course.