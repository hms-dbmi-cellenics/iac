const AWS = require('aws-sdk');
const crypto = require('crypto');
const k8s = require('@kubernetes/client-node');
const config = require('../../config');
const logger = require('../../utils/logging');

class WorkSubmitService {
  constructor(workRequest) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sBatchApi = this.kc.makeApiClient(k8s.BatchV1Api);

    this.workRequest = workRequest;

    this.workerHash = crypto
      .createHash('sha1')
      .update(this.workRequest.experimentId)
      .digest('hex');

    if (config.clusterEnv === 'development') {
      this.workQueueName = 'development-queue.fifo';
    } else {
      this.workQueueName = `queue-job-${this.workerHash}-${config.clusterEnv}.fifo`;
    }
  }

  /**
   * Creates or locates an SQS queue for the appropriate
   * worker.
   */
  async createQueue() {
    const sqs = new AWS.SQS({
      region: config.awsRegion,
    });
    const q = await sqs.createQueue({
      QueueName: this.workQueueName,
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
  async sendMessageToQueue(queueUrl) {
    logger.log('in the sendMessageToQueue function...');
    const sqs = new AWS.SQS({
      region: config.awsRegion,
    });
    await sqs.sendMessage({
      MessageBody: JSON.stringify(this.workRequest),
      QueueUrl: queueUrl,
      MessageGroupId: 'work',
    }).promise();
  }

  async getQueueAndHandleMessage() {
    try {
      const accountId = await config.awsAccountIdPromise;
      const queueUrl = `https://sqs.${config.awsRegion}.amazonaws.com/${accountId}/${this.workQueueName}`;
      await this.sendMessageToQueue(queueUrl);
    } catch (error) {
      if (error.code !== 'AWS.SimpleQueueService.NonExistentQueue') { throw error; }
      const queueUrl = await this.createQueue();
      await this.sendMessageToQueue(queueUrl);
    }
    return 'success';
  }

  /**
    * Launches a Kubernetes `Job` with the appropriate configuration.
    */
  async createWorker() {
    if (config.clusterEnv === 'development') {
      logger.log('Not creating a worker because we are running locally...');
      return;
    }

    const accountId = await config.awsAccountIdPromise;
    const namespaceName = 'worker-refs-heads-master';
    const imageUrl = `${accountId}.dkr.ecr.${config.awsRegion}.amazonaws.com/worker:refs-heads-master-latest`;

    try {
      await this.k8sBatchApi.createNamespacedJob(namespaceName, {
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
                  image: imageUrl,
                  env: [
                    {
                      name: 'WORK_QUEUE',
                      value: this.workQueueName,
                    },
                    {
                      name: 'K8S_ENV',
                      value: `${config.clusterEnv}`,
                    },
                  ],
                },
              ],
              serviceAccountName: 'deployment-runner',
              restartPolicy: 'OnFailure',
            },
          },
        },
      });
    } catch (error) {
      if (error.statusCode !== 409) {
        logger.trace(error);
        logger.error(error.statusCode);
        throw new Error(error);
      }
    }
  }

  async submitWork() {
    await Promise.all([
      this.createWorker(),
      this.getQueueAndHandleMessage(),
    ]);
  }
}

module.exports = WorkSubmitService;
