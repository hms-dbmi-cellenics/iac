const express = require('express');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const uuid = require('uuid');

const app = express();
const bodyParser = require('body-parser');

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

app.use(bodyParser.json());

app.post('/',
  async (req, res) => {
    const work = {
      uuid: uuid.v4(),
      count_matrix: req.body.file_path,
      experiment: 'my-amazing-experiment',
      task: 'ComputeEmbedding',
      details: {
        type: 'PCA',
        cells: 'all',
        dimensions: 3,
      },
    };

    const workerHash = crypto
      .createHash('sha1')
      .update(work.experiment)
      .digest('hex');

    const workQueueName = `queue-job-${workerHash}.fifo`;

    let dockerConfig = {
      auths: {
        'registry.gitlab.com': {
          username: `${process.env.WORKER_DEPLOY_USER}`,
          password: `${process.env.WORKER_DEPLOY_PASSWORD}`,
        },
      },
    };

    dockerConfig = Buffer.from(JSON.stringify(dockerConfig)).toString('base64');

    const sqs = new AWS.SQS({
      region: 'eu-west-2',
    });

    const q = await sqs.createQueue({
      QueueName: workQueueName,
      Attributes: {
        FifoQueue: 'true',
        ContentBasedDeduplication: 'true',
      },
    }).promise();

    const { QueueUrl: queueUrl } = q;

    sqs.sendMessage({
      MessageBody: JSON.stringify(work),
      QueueUrl: queueUrl,
      MessageGroupId: 'work',
    }).promise().then(() => k8sCoreApi.createNamespacedSecret('default', {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `job-${workerHash}-docker-secret`,
        labels: {
          job: workerHash,
          experiment: work.experiment,
        },
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': dockerConfig,
      },
    })).then(() => k8sBatchApi.createNamespacedJob('default', {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `job-${workerHash}`,
        labels: {
          job: workerHash,
          experiment: work.experiment,
        },
      },
      spec: {
        template: {
          metadata: {
            name: `job-${workerHash}-template`,
            labels: {
              job: workerHash,
              experiment: work.experiment,
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
    }));

    res.json(work);
  });

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500);
  res.json({ status: 500, message: 'There has been an error.' });
});

app.listen(process.env.PORT || 3000);
