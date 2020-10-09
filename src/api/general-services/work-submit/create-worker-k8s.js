const util = require('util');
const fs = require('fs').promises;
const tmp = require('tmp-promise');
const childProcess = require('child_process');
const fetch = require('node-fetch');
const YAML = require('yaml');
const { Downloader } = require('github-download-directory');
const config = require('../../../config');


const constructChartValues = async (service) => {
  const { workQueueName } = service;
  const { experimentId } = service.workRequest;
  const { clusterEnv } = config;

  const response = await fetch(
    config.workerInstanceConfigUrl,
    {
      method: 'GET',
    },
  );

  return response.text().then((txt) => {
    const cfg = YAML.parse(txt);

    return {
      ...cfg,
      experimentId,
      clusterEnv,
      workQueueName,
      storageSize: '10Gi',
    };
  });
};

const createWorkerResources = async (service) => {
  const { workerHash } = service;
  const HELM_BINARY = '/usr/local/bin/helm';

  // Download value template from Git repository. Fill in needed things.
  const execFile = util.promisify(childProcess.execFile);
  const instanceConfig = await constructChartValues(service);
  const { name } = tmp.fileSync();
  await fs.writeFile(name, YAML.stringify(instanceConfig));

  // Download the chart from the worker repository.
  const custom = new Downloader({
    github: { auth: '64ed5ec7a15c641069525e5c43464ead8bbdc20b' },
  });
  await custom.download('biomage-ltd', 'worker', 'chart-instance');

  const params = `upgrade ${workerHash} chart-instance/ --namespace ${instanceConfig.namespace} --install --wait -o json`.split(' ');
  const releases = await execFile(HELM_BINARY, params);
  console.log(JSON.parse(releases.stdout));
};

module.exports = createWorkerResources;
