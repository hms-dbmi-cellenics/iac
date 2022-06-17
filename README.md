# iac

Our infrastructure as code.

Base infrastructure
-------------------

Base infrastructure means infrastructure required for Cellenics to be deployed.
This broadly corresponds to the kubernetes cluster and closely related infrastructure. This
infrastructure is deployed *manually* by launching the action *Deploy Biomage infrastructure*
from the [actions](https://github.com/hms-dbmi-cellenics/iac/actions?query=workflow%3A%22Deploy+Biomage+infrastructure+on+AWS%22).
The configuration for these infraustructure components are under `infra/`.

#### Required secrets to deploy infrastructure
Some secrets are required to deploy infrastructure into AWS and configure the infrastructure and deployment:

- AWS_ACCESS_KEY_ID

  The access key ID of the IAM user that the IAC repo will assume.

- AWS_SECRET_ACCESS_KEY

  Secret access key of the access key ID.

- API_TOKEN_GITHUB

  API token from the Github account that will be used by Flux to access and manage this repository.

- DOMAIN_NAME

  The domain name that Cellenics will be deployed under (e.g. scp.biomage.net)

- PRIMARY_DOMAIN_NAME

  The primary domain where Cellenics is deployed to (e.g. biomage.net)

- DOMAIN_NAME_STAGING (optional, for Biomage use only)

  The subdomain that the staging instance of Cellenics will be deployed (e.g. scp-staging.biomage.net)

#### Changing base infrastructure
The github workflow that triggers an update to the base infrastructure with the files in `infra/` is [deploy-infra.yaml](https://github.com/hms-dbmi-cellenics/iac/blob/master/.github/workflows/deploy-infra.yaml). At the moment, this workflow has to be manually triggered for the update to happen. To trigger an update, you have to:
1. Go to the *Deploy Biomage infrastructure*
[actions](https://github.com/hms-dbmi-cellenics/iac/actions?query=workflow%3A%22Deploy+Biomage+infrastructure+on+AWS%22). Select *Deploy Biomage infrastructure* workflow from the list of workflows.
2. Click on `Run workflow` dropdown on the right side of the top workflow result. With this dropdown, you will configure the inputs with which the workflow will be run. 
3. `Use worklow from` defines which changes the build will be run wuth. Make sure it is set to `master` to avoid situations when infrastructure changes from other branch are deployed and we have unknown state.
4. `Select actions to perform` defines what kind of changes you want to apply to the infrastructure. There are 2 options available to select from:
    
    - `deploy and configure`: If you've made changes that require re-creation of the cluster. For example: changing the EC2 node type.
    - `configure`: The default option. If you've made changes that only require update of the configuratio of the existing cluster. Most of the time, you will need to use option `configure`.

5. After you've made your selections, click `run workflow`. This will update or recreate and update the cluster in the AWS region specified using the state of the iac repo in the branch selected in `use workflow from`.

### The Kubernetes Cluster

The cluster is deployed using [eksctl](https://eksctl.io/introduction/) by the CI pipeline. The
corresponding *ClusterConfig* is available under `infra/cluster.yaml`.

Note: per the eksctl documentation, **node groups are immutable**. If you want to change the node group
type, storage size, or any other property, you must delete the old node group from the configuration,
and add a new one with a different name. eksctl will then appropriately drain and set up node groups.

The name of the EKS cluster is always `biomage-$ENVIRONMENT`, where `$ENVIRONMENT` is the cluster environment
(`staging` or `production`). You must add `$ENVIRONMENT` as an environment variable or substitute it accordingly
when you run these commands.

### Accessing the cluster
By default, eksctl only grants cluster admin rights to the user that created the cluster, i.e. the CI
user for the GitHub repo. The file `infra/cluster_admins` contains a list of IAM users for whom admin
rights will be granted. The file `infra/cluster_users` contains a list of IAM users that have only user rights
granted.

#### 1. Make sure you have the correct aws credentials set in your `~/.aws/credentials` file. 

To check if your credentials are correct, try running step 2. If step 2 fails with an error saying `error: You must be logged in to the server (Unauthorized)` this means that your current credentials are wrong. In that case, talk to Iva to give you correct ones.

#### 2. Configure kube config to point to the right cluster.
This step guides you through how to configure your kubeconfig file in order to have access to the
cluster locally.
In a new terminal, execute the following commands:

    # remove the old config so that accidental operations on the
    # wrong cluster are prevented.
    $ rm ~/.kube/config

    # grant access to the cluster.
    $ aws eks update-kubeconfig --name biomage-$ENVIRONMENT --region eu-west-1

    # Verify that all worked fine: execute get nodes command
    # If everything is working, you should see something similar to this:
    # NAME                                           STATUS   ROLES    AGE   VERSION
    # ip-192-168-33-132.eu-west-1.compute.internal   Ready    <none>   40h   v1
    # ip-192-168-81-140.eu-west-1.compute.internal   Ready    <none>   40h   v1

    $ kubectl get nodes


#### 3. Access the cluster graphically
This step is optional and lets you use a nice intuitive user interface to interact with Kubernetes.
Simply download and install [lens](https://k8slens.dev/) and then follow the instructions specified there.

### Ingress

Ingress into the cluster is managed by the [AWS Load Balancer Controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller).

After the AWS Load Balancer Controller is installed, the DNS of the hosted domain must be modified to redirect to the
load balancer automatically. This is done automatically as a CloudFormation chart under `infra/cf-route53.yaml`.

Ingress resources need to specify the following in their annotations for them to be managed by the AWS Load Balancer Controller:

    kubernetes.io/ingress.class: alb

This is automatically configured for the charts in this repository.    

**Important**: When the cluster is (re)deployed, there may be a delay in the DNS changes propagating to all hosts on
the internet. If redeploying the infrastructure to another region, **make sure the old deployment still exists**.
There can only be one deployment bound to the domain at any given time. Destroying the old deployment before creating
the new one will result in downtime.

Deployments
-----------

Deployments refer to the instances of various  services running to use the single-cell pipeline, e.g. `ui`, `api`, `worker`
copies. Deployments are managed *automatically* by [Flux](http://fluxcd.io/).

### Flux

Flux is a GitOps Continuous Delivery platform. It is deployed on the cluster alongside all other base infrastructure. It
manages custom resources called *HelmRelease*. A HelmRelease contains data identifying the Helm Chart that is to be deployed,
as well as any custom configuration to the chart that may be necessary. Broadly, it is designed to automate manual
`helm install` or `helm upgrade` operations.

Flux is granted read and write access to this repository by the deploy script. This is by automatically creating/updating a
[deploy key](https://github.com/hms-dbmi-cellenics/iac/settings/keys) for this repository by the base infrastructure deployment
workflow.

### Releases

Flux running on the `$ENVIRONMENT` cluster is continuously scanning the `releases/$ENVIRONMENT/` folder in this directory
for updates. When a change to a file in the `releases/$ENVIRONMENT/` folder is found, Flux will automaticlly apply those
changes to the Helm chart release on the cluster. For example, if a `ui` deployment needs to run on a non-standard port,
the *HelmRelease* resource corresponding to this deployment is pushed to GitHub, and these changes are automatically picked up
applied on the cluster.

Each repository corresponding to a deployment is responsible for managing its own HelmRelease
resource in this repository. See the section on CI for more details, and [this](https://github.com/fluxcd/helm-operator-get-started)
explanation of how Flux works.

**Important**: Accordingly, the path `releases/` is automatically populated by the CI/CD
pipelines of various Biomage deployments. Do not commit, push, or submit a pull
request to change manifests in this directory. Pull requests attempting to modify
files except documentation in this directory will be automatically rejected.

### Charts

The `charts/` folder contains various pre-written charts that are widely useful for deployments.
For example, the `charts/nodejs` chart is for deploying a Node.js server, which is used by
both `ui` and `api` in their HelmRelease configurations.

AWS resources
-------------

AWS resources refer to things not described above that can be managed and configured using
CloudFormation e.g. DynamoDB tables, ElastiCache Redis clusters, S3 buckets, etc. These are
managed *automatically* by a GitHub action, and they are available under `cf/`.

### General resources

Resources under `cf/` are CloudFormation templates that describe a particular deployment.
Changes to `cf/` files are automatically picked up and deployed by the CI pipeline.

**Important:** Make sure each template covers a broadly related group of resources, ideally
consisting of only one type of resource. This ensures applying changes is as easy as possible.

Each CloudFormation template must have an `Environment` parameter that accepts a valid cluster
environment (`staging`, `production`) or `development`. The `development` environment is used
by InfraMock for local mocking of the resource. Templates should use this variable to create
environment-specific resources.

**Important**: Always use the available `AWS::Region` and `AWS::AccountId` variables when
writing CloudFormation templates. This ensures that the resources are portable to various
regions and account IDs.

### IAM Roles for Service Accounts (IRSA) resources

These are a special type of resource, identified by files in the `irsa-*.yaml` format. They
are used by AWS to grant a limited set of permissions to each deployment.

They are regular CloudFormation templates, but they must also accept an `OIDCProvider`
parameter, which is automatically filled in by the pipeline when the changes
are applied. This is used to ensure the role is only granted to the appropriate
service account. See [here](https://docs.aws.amazon.com/eks/latest/userguide/create-service-account-iam-policy-and-role.html)
for more details.

The `AssumeRolePolicyDocument` is filled in per the documentation above. Ensure that
the policy follows least privilege in who can access the resources, at least specifying
the correct deployment source and the name of the service account, e.g.:

    system:serviceaccount:worker-*:deployment-runner

The permissions are configured as with any other IAM Role deployment. Make sure these
follow best practice, with each resource appropriately scoped by account ID, region,
environment, etc.

Continuous Integration
----------------------

CI is managed by GitHub actions. Each repository has its own custom CI pipeline, but
they broadly follow a `Test > Build > Push image > Push HelmRelease`
pattern.

### Images

Docker images are built by CI and pushed to AWS ECR. Each repository should have a
container repository with the same name in ECR. This repository should be checked
and created by CI if it is not present.

### Deployment

Each repository is responsible for managing its own HelmRelease files. Each repository
that deploys a HelmRelease should have a `.flux.ci` file that contains the base template
that the CI pipeline will fill in and extend. The CI pipeline for a given project will
push this filled template to this repository under `releases/` for Flux to pick it up.

### CI privileges

Each CI pipeline needs a certain set of permissions from both GitHub and AWS to operate.
AWS privileges that should be available to the CI pipeline should be placed under `.ci.yaml`.

Changes to CI privileges must be deployed *manually* by someone with sufficient access
by running `biomage rotate-ci` using [biomage-utils](https://github.com/hms-dbmi-cellenics/biomage-utils).
