# iac

Our infrastructure as code.

Base infrastructure
-------------------

Base infrastructure means infrastructure required for the single-cell pipeline to be deployed.
This broadly corresponds to the kubernetes cluster and closely related infrastructure. This
infrastructure is deployed *manually* by launching the action *Deploy Biomage infrastructure*
from the [actions](https://github.com/biomage-ltd/iac/actions?query=workflow%3A%22Deploy+Biomage+infrastructure+on+AWS%22).
The configuration for these infraustructure components are under `infra/`.

As they are manually deployed, changes to them require someone with suitable permissions to be applied.

### The Kubernetes Cluster

The cluster is deployed using [eksctl](https://eksctl.io/introduction/) by the CI pipeline. The
corresponding *ClusterConfig* is available under `infra/cluster.yaml`.

Note: per the eksctl documentation, **node groups are immutable**. If you want to change the node group
type, storage size, or any other property, you must delete the old node group from the configuration,
and add a new one with a different name. eksctl will then appropriately drain and set up node groups.

The name of the EKS cluster is always `biomage-$ENVIRONMENT`, where `$ENVIRONMENT` is the cluster environment
(`staging` or `production`).

### Accessing the cluster

By default, eksctl only grants cluster admin rights to the user that created the cluster, i.e. the CI
user for the GitHub repo. The file `infra/cluster_admins` contains a list of IAM users for whom admin
rights will be granted. Once the pipeline runs, you can use:

    # removing the old config is might be useful so there is only one cluster that is
    # accessible to you at any given time. this prevents accidental operations on
    # the wrong cluster.
    $ rm ~/.kube/config

    # grant access to cluster
    $ aws eks update-kubeconfig --name biomage-$ENVIRONMENT --region eu-west-1

    # get nodes
    $ kubectl get nodes

This will edit your kubeconfig file and allow you to access the cluster. To access the cluster graphically,
download and install [lens](https://k8slens.dev/).

### Ingress

Ingress into the cluster is managed by an NGINX Ingress Controller. This is automatically set up by the pipeline
according to the instructions [here](https://kubernetes.github.io/ingress-nginx/deploy/#aws). There is no Helm
chart supporting this exact deployment, so a regular manifest file is applied. The deployment creates an Elastic
Load Balancer automatically.

After NGINX Ingress Controller is installed, the DNS of the hosted domain must be modified to redirect to the
load balancer automatically. This is done automatically as a CloudFormation chart under `infra/cf-route53.yaml`.

Ingress resources need to specify the following in their annotations for them to be managed by the NGINX Ingress
Controller:

    kubernetes.io/ingress.class: "nginx"

This is automatically configured for the charts in this repository.    

**Important**: When the cluster is (re)deployed, there may be a delay in the DNS changes propagating to all hosts on
the internet. If redeploying the infrastructure to another region, **make sure the old deployment still exists**.
There can only be one deployment bound to the domain at any given time. Destroying the old deployment before creating
the new one will result in downtime.

### TLS certificates

TLS certificates are handled by [cert-manager](https://cert-manager.io/) which is deployed using a Helm chart
and can be accessed in Lens under `Apps > Releases`. This sets up the infrastructure necessary to automatically
manage TLS certificates.

We use Let's Encrypt for our deployment's TLS certificates. To configure cert-manager to use this, we need to install
a `ClusterIssuer` resource to configure cert-manager to recognize it as a way of getting certificates. This is automatically
managed by the pipeline by deploying the Helm chart under `infra/k8s-cert-manager-issuers`. The ClusterIssuer called
*letsencrypt-prod* (under `infra/k8s-cert-manager-issuers/templates/le-prod-issuer.yaml`) is the one that generates
valid certificates, the *letsencrypt-staging* is used for verifying a configuration if there are errors, as the
production version is rate-limited.

To use *letsencrypt-prod* as the issuer for a TLS certificate, the Ingress deployed must have the following annotation:

    cert-manager.io/cluster-issuer: "letsencrypt-prod"

This is automatically configured for the charts in this repository.

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
[deploy key](https://github.com/biomage-ltd/iac/settings/keys) for this repository by the base infrastructure deployment
workflow.

### Releases

Flux is continuously scanning the `releases/` folder in this directory for updates. When a change
to a file in the `releases/` folder is found, Flux will automaticlly apply those changes to the Helm chart
release on the cluster. For example, if a `ui` deployment needs to run on a non-standard port, the *HelmRelease*
resource corresponding to this deployment is pushed to GitHub, and these changes are automatically picked up
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
by running `biomage rotate-ci` using [biomage-utils](https://github.com/biomage-ltd/biomage-utils).