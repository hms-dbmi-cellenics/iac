const AWS = require('aws-sdk');
const crypto = require('crypto');
const uuid = require('uuid');
const k8s = require('@kubernetes/client-node');

class WorkService {
  constructor(json) {
    this.json = json;
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sBatchApi = this.kc.makeApiClient(k8s.BatchV1Api);

    this.sqs = new AWS.SQS({
      region: 'eu-west-2',
    });
  }

  getWorkerHash() {
    const workerHash = crypto
      .createHash('sha1')
      .update(this.workToSubmit.experiment)
      .digest('hex');

    return workerHash;
  }

  getWorkQueueName() {
    return `queue-job-${this.getWorkerHash()}.fifo`;
  }

  async createQueue() {
    const workQueueName = this.getWorkQueueName();

    const q = await this.sqs.createQueue({
      QueueName: workQueueName,
      Attributes: {
        FifoQueue: 'true',
        ContentBasedDeduplication: 'true',
      },
    }).promise();

    const { QueueUrl: queueUrl } = q;

    return queueUrl;
  }

  static createDockerRegistryAuth() {
    let dockerConfig = {
      auths: {
        'registry.gitlab.com': {
          username: `${process.env.WORKER_DEPLOY_USER}`,
          password: `${process.env.WORKER_DEPLOY_PASSWORD}`,
        },
      },
    };

    dockerConfig = Buffer.from(JSON.stringify(dockerConfig)).toString('base64');

    return dockerConfig;
  }

  sendMessageToQueue(queueUrl) {
    return this.sqs.sendMessage({
      MessageBody: JSON.stringify(this.workToSubmit),
      QueueUrl: queueUrl,
      MessageGroupId: 'work',
    }).promise();
  }

  createDockerDeploymentSecret() {
    const workerHash = this.getWorkerHash();

    return this.k8sCoreApi.createNamespacedSecret('default', {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `job-${workerHash}-docker-secret`,
        labels: {
          job: workerHash,
          experiment: this.workToSubmit.experiment,
        },
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': WorkService.createDockerRegistryAuth(),
      },
    });
  }

  createJob() {
    const workerHash = this.getWorkerHash();
    const workQueueName = this.getWorkQueueName();

    this.k8sBatchApi.createNamespacedJob('default', {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `job-${workerHash}`,
        labels: {
          job: workerHash,
          experiment: this.workToSubmit.experiment,
        },
      },
      spec: {
        template: {
          metadata: {
            name: `job-${workerHash}-template`,
            labels: {
              job: workerHash,
              experiment: this.workToSubmit.experiment,
            },
          },
          spec: {
            containers: [
              {
                name: `job-${workerHash}-container`,
                image: 'registry.gitlab.com/biomage/worker/master',
                env: [
                  {
                    name: 'WORK_QUEUE',
                    value: workQueueName,
                  },
                  {
                    name: 'AWS_ACCESS_KEY_ID',
                    value: process.env.WORKER_AWS_ACCESS_KEY_ID,
                  },
                  {
                    name: 'AWS_SECRET_ACCESS_KEY',
                    value: process.env.WORKER_AWS_SECRET_ACCESS_KEY,
                  },
                  {
                    name: 'AWS_DEFAULT_REGION',
                    value: 'eu-west-2',
                  },
                ],
              },
            ],
            restartPolicy: 'OnFailure',
            imagePullSecrets: [
              {
                name: `job-${workerHash}-docker-secret`,
              },
            ],
          },
        },
      },
    });
  }

  async submitWork() {
    this.workToSubmit = {
      uuid: uuid.v4(),
      count_matrix: this.json.file_path,
      experiment: 'my-amazing-experiment',
      task: 'ComputeEmbedding',
      details: {
        type: 'PCA',
        cells: 'all',
        dimensions: 3,
      },
    };

    const queueUrl = await this.createQueue();

    this.sendMessageToQueue(queueUrl)
      .then(() => this.createDockerDeploymentSecret())
      .then(() => this.createJob())
      .then(() => { console.log('everything launched'); return null; });
  }
}

module.exports = WorkService;
