const AWS = require('aws-sdk');
const crypto = require('crypto');
const uuid = require('uuid');
const k8s = require('@kubernetes/client-node');
const config = require('../../config');

class WorkRequestService {
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
    return `queue-job-${this.getWorkerHash()}-${config.clusterEnv}.fifo`;
  }

  /**
   * Creates or locates an SQS queue for the appropriate
   * worker.
   */
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

  /**
   * Returns a `Promise` to send an appropriately
   * formatted task to the Job via an SQS queue.
   * @param {string} queueUrl adsas
   */
  sendMessageToQueue(queueUrl) {
    return this.sqs.sendMessage({
      MessageBody: JSON.stringify(this.workToSubmit),
      QueueUrl: queueUrl,
      MessageGroupId: 'work',
    }).promise();
  }

  /**
    * Launches a Kubernetes `Job` with the appropriate configuration.
    */
  createWorker() {
    const workerHash = this.getWorkerHash();
    const workQueueName = this.getWorkQueueName();

    // TODO: this needs to be set to `development` when we have separate environments deployed.
    const namespaceName = `worker-18327207-${config.clusterEnv}`;


    return this.k8sBatchApi.createNamespacedJob(namespaceName, {
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
                    valueFrom: {
                      secretKeyRef: {
                        name: `${config.clusterEnv}-secret`,
                        key: 'AWS_ACCESS_KEY_ID',
                      },
                    },
                  },
                  {
                    name: 'AWS_SECRET_ACCESS_KEY',
                    valueFrom: {
                      secretKeyRef: {
                        name: `${config.clusterEnv}-secret`,
                        key: 'AWS_SECRET_ACCESS_KEY',
                      },
                    },
                  },
                  {
                    name: 'AWS_DEFAULT_REGION',
                    valueFrom: {
                      secretKeyRef: {
                        name: `${config.clusterEnv}-secret`,
                        key: 'AWS_DEFAULT_REGION',
                      },
                    },

                  },
                  {
                    name: 'WORK_TIMEOUT',
                    value: '10',
                  },
                ],
              },
            ],
            restartPolicy: 'OnFailure',
            imagePullSecrets: [
              {
                name: 'worker-image-pull-secrets',
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

    await this.createQueue().then(
      (queueUrl) => this.sendMessageToQueue(queueUrl),
    );

    this.createWorker().catch((e) => {
      if (e.statusCode !== 409) {
        throw new Error(e);
      }
    });
  }
}

module.exports = WorkRequestService;
