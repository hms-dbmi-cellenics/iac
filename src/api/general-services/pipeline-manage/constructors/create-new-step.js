const uuid = require('uuid');
const config = require('../../../../config');

const createNewStep = (context, step, args) => {
  const {
    processingConfig, clusterInfo, experimentId, pipelineArtifacts, accountId,
  } = context;

  const { taskName } = args;
  const remoterServer = (
    config.clusterEnv === 'development'
  ) ? 'host.docker.internal'
    : `remoter-server-${experimentId}.${config.pipelineNamespace}.svc.cluster.local`;

  const task = JSON.stringify({
    experimentId,
    taskName,
    config: processingConfig[taskName] || {},
    server: remoterServer,
  });

  // UUIDs are 16 bytes long, base64 produces four characters per
  // three-byte chunk. Since 16 mod 3 = 1, the data needs to be
  // padded out with `==` to align it to 3-bit chunks. `=` is not
  // a valid k8s resource character so we can safely remove two
  // from the end.
  const stepHash = Buffer.from(
    uuid.parse(uuid.v4()),
  ).toString('base64').slice(0, -2);

  if (config.clusterEnv === 'development') {
    return {
      ...step,
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      // TODO: fix this, add some of old output
      // see https://docs.aws.amazon.com/step-functions/latest/dg/input-output-resultpath.html
      ResultPath: null,
      Parameters: {
        FunctionName: `arn:aws:lambda:eu-west-1:${accountId}:function:local-container-launcher`,
        Payload: {
          image: 'biomage-remoter-client',
          'name.$': 'States.Format(\'pipeline-remoter-client-{}\', $.sampleUuid)',
          task,
          'sampleUuid.$': '$.sampleUuid',
          detached: false,
        },
      },
      Catch: [
        {
          ErrorEquals: ['States.ALL'],
          ResultPath: '$.error-info',
          Next: step.XNextOnCatch || step.Next,
        },
      ],
    };
  }


  return {
    ...step,
    Type: 'Task',
    Comment: 'Attempts to create a Kubernetes Job for the pipeline server. Will swallow a 409 (already exists) error.',
    Resource: 'arn:aws:states:::eks:runJob.sync',
    // TODO: fix this, add some of old output
    // see https://docs.aws.amazon.com/step-functions/latest/dg/input-output-resultpath.html
    ResultPath: null,
    Parameters: {
      ClusterName: clusterInfo.name,
      CertificateAuthority: clusterInfo.certAuthority,
      Endpoint: clusterInfo.endpoint,
      Namespace: config.pipelineNamespace,
      LogOptions: {
        RetrieveLogs: true,
      },
      Job: {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          'name.$': `States.Format('remoter-client-${stepHash}-{}', $.sampleUuid)`,
          labels: {
            sandboxId: config.sandboxId,
            experimentId,
            taskName,
            type: 'pipeline',
          },
        },
        spec: {
          template: {
            metadata: {
              'name.$': `States.Format('remoter-client-${stepHash}-{}', $.sampleUuid)`,
              labels: {
                sandboxId: config.sandboxId,
                type: 'pipeline',
              },
            },
            spec: {
              containers: [
                {
                  name: 'remoter-client',
                  image: pipelineArtifacts['remoter-client'],
                  args: [
                    task,
                  ],
                  env: [
                    {
                      name: 'SAMPLE_ID',
                      'value.$': '$.sampleUuid',
                    },
                  ],
                },
              ],
              restartPolicy: 'Never',
            },
          },
        },
      },
    },
    Retry: [
      {
        ErrorEquals: ['EKS.409'],
        IntervalSeconds: 1,
        BackoffRate: 2.0,
        MaxAttempts: 2,
      },
    ],
    Catch: [
      {
        ErrorEquals: ['EKS.409'],
        ResultPath: '$.error-info',
        Next: step.XNextOnCatch || step.Next,
      },
    ],
  };
};

module.exports = createNewStep;
