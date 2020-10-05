const k8s = require('@kubernetes/client-node');
const config = require('../../../config');

const createWorkerResources = async (service) => {
  const namespaceName = 'worker-refs-heads-master';

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();

  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
  const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

  const accountId = await config.awsAccountIdPromise();
  const imageUrl = `${accountId}.dkr.ecr.${config.awsRegion}.amazonaws.com/worker:refs-heads-master-latest`;

  await k8sCoreApi.createNamespacedPersistentVolumeClaim(namespaceName, {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: `job-${service.workerHash}`,
    },
    spec: {
      accessModes: [
        'ReadWriteOnce',
      ],
      storageClassName: 'worker-storage',
      resources: {
        requests: {
          storage: '10Gi',
        },
      },
    },
  });

  await k8sBatchApi.createNamespacedJob(namespaceName, {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: `job-${service.workerHash}`,
      labels: {
        job: service.workerHash,
        experimentId: service.workRequest.experimentId,
      },
    },
    spec: {
      template: {
        metadata: {
          name: `job-${service.workerHash}-template`,
          labels: {
            job: service.workerHash,
            experimentId: service.workRequest.experimentId,
          },
        },
        spec: {
          containers: [
            {
              name: `job-${service.workerHash}-container`,
              image: imageUrl,
              imagePullPolicy: 'Always',
              env: [
                {
                  name: 'WORK_QUEUE',
                  value: service.workQueueName,
                },
                {
                  name: 'K8S_ENV',
                  value: `${config.clusterEnv}`,
                },
              ],
              volumeMounts: [
                {
                  name: 'data',
                  mountPath: '/data',
                },
              ],
            },
          ],
          volumes: [
            {
              name: 'data',
              persistentVolumeClaim: {
                claimName: `job-${service.workerHash}`,
              },
            },
          ],
          serviceAccountName: 'deployment-runner',
          restartPolicy: 'OnFailure',
        },
      },
    },
  });
};

module.exports = createWorkerResources;
