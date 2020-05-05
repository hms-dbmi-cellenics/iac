const AWS = require('aws-sdk');
const crypto = require('crypto');
const k8s = require('@kubernetes/client-node');
const config = require('../../config');


class WorkSubmitService {
  constructor(workRequest) {
    console.log('worksubmit constructor started');
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sBatchApi = this.kc.makeApiClient(k8s.BatchV1Api);

    this.sqs = new AWS.SQS({
      region: 'eu-west-2',
    });

    this.sts = new AWS.STS();

    this.workRequest = workRequest;

    this.workerHash = crypto
      .createHash('sha1')
      .update(this.workRequest.experimentId)
      .digest('hex');

    this.workQueueName = `queue-job-${this.workerHash}-${config.clusterEnv}.fifo`;

    AWS.config.getCredentials((err) => {
      if (err) console.log(err.stack);
      // credentials not loaded
      else {
        console.log('Access key:', AWS.config.credentials.accessKeyId);
        console.log('Secret access key:', AWS.config.credentials.secretAccessKey);
      }
    });

    console.log('worksubmit constructor finished');
  }

  /**
   * Creates or locates an SQS queue for the appropriate
   * worker.
   */
  async createQueue() {
    console.log('createQueue start start');

    const q = await this.sqs.createQueue({
      QueueName: this.workQueueName,
      Attributes: {
        FifoQueue: 'true',
        ContentBasedDeduplication: 'true',
      },
    }).promise();

    console.log('createQueue finished.');

    const { QueueUrl: queueUrl } = q;

    console.log('returning createqueue');

    return queueUrl;
  }

  /**
   * Returns a `Promise` to send an appropriately
   * formatted task to the Job via an SQS queue.
   * @param {string} queueUrl adsas
   */
  sendMessageToQueue(queueUrl) {
    console.log('sendMessageToQueue start');
    return this.sqs.sendMessage({
      MessageBody: JSON.stringify(this.workRequest),
      QueueUrl: queueUrl,
      MessageGroupId: 'work',
    }).promise();
  }

  getQueueUrl() {
    // First, get account ID, then construct queue URL from the available
    // data.
    return this.sts.getCallerIdentity({})
      .promise()
      .then((data) => { console.log(data); return `https://sqs.${AWS.SQS.region}.amazonaws.com/${data.Account}/${this.workQueueName}`; });
  }

  /**
    * Launches a Kubernetes `Job` with the appropriate configuration.
    */
  createWorker() {
    // TODO: this needs to be set to `development` when we have separate environments deployed.
    const namespaceName = `worker-18327207-${config.clusterEnv}`;


    return this.k8sBatchApi.createNamespacedJob(namespaceName, {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `job-${this.workerHash}`,
        labels: {
          job: this.workerHash,
          experimentId: this.workRequest.experimentId,
        },
      },
      spec: {
        template: {
          metadata: {
            name: `job-${this.workerHash}-template`,
            labels: {
              job: this.workerHash,
              experimentId: this.workRequest.experimentId,
            },
          },
          spec: {
            containers: [
              {
                name: `job-${this.workerHash}-container`,
                image: 'registry.gitlab.com/biomage/worker/master',
                env: [
                  {
                    name: 'WORK_QUEUE',
                    value: this.workQueueName,
                  },
                  {
                    name: 'GITLAB_ENVIRONMENT_NAME',
                    value: `${config.clusterEnv}`,
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
    console.log('before creating queue');

    this.getQueueUrl().then((url) => {
      console.log(url);
    });
    /*
    await this.createQueue().then(
      (queueUrl) => this.sendMessageToQueue(queueUrl),
    );

    console.log('sent to queue');

    this.createWorker().catch((e) => {
      if (e.statusCode !== 409) {
        throw new Error(e);
      }
    });
    */
  }
}

module.exports = WorkSubmitService;
