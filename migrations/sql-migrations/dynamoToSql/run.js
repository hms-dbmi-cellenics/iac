const _ = require('lodash');

const AWS = require('aws-sdk');

const knexfileLoader = require('../knexfile');
const knex = require('knex');

const Helper = require('./Helper');

const { v4: uuidv4 } = require('uuid');

// ----------------------Dynamo dumps----------------------
const projectsJson = require('../downloaded_data/projects-production.json');
const experimentsJson = require('../downloaded_data/experiments-production.json');
const samplesJson = require('../downloaded_data/samples-production.json');
const userAccessJson = require('../downloaded_data/user-access-production.json');
const inviteAccessJson = require('../downloaded_data/invite-access-production.json');
const plotsJson = require('../downloaded_data/plots-tables-production.json');

// ----------------------Dynamo dumps END------------------

const environments = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
};

const activeEnvironment = environments.DEVELOPMENT;

const createSqlClient = async () => {
  const knexfile = await knexfileLoader(activeEnvironment);
  return knex.default(knexfile[activeEnvironment]);
}

const migrateProject = async (project, helper) => {
  const { projectUuid, projects: projectData } = project;
  const experimentId = projectData.experiments[0];
  const experimentData = _.find(experimentsJson, { 'experimentId': experimentId });

  const sampleData = _.find(samplesJson, { 'experimentId': experimentId });

  console.log(`Migrating ${projectUuid}, experiment ${experimentId}`);

  if (_.isNil(projectData), _.isNil(experimentData), _.isNil(sampleData)) {
    console.log(`[ ERROR ] - ${experimentId} - One of these is nil:`);
    console.log(`projectData: ${projectData}, experimentData: ${experimentData}, sampleData: ${sampleData}`)
    return;
  }
  
  await helper.sqlInsertExperiment(experimentId, projectData, experimentData);

  // Create experiment executions if we need to
  if (!_.isNil(experimentData.meta.gem2s)) {
    await helper.sqlInsertExperimentExecutionGem2s(experimentId, experimentData);
  }

  if (!_.isNil(experimentData.meta.pipeline)) {
    await helper.sqlInsertExperimentExecutionQC(experimentId, experimentData);
  }

  const samples = Object.values(sampleData.samples);
  if (samples.length === 0) {
    console.log(`No samples in the project ${projectUuid}, experiment ${experimentId}`)
  }

  // Migrate all samples
  await Promise.all(
    samples.map(async (sample) => {

      await helper.sqlInsertSample(experimentId, sample);

      const files = Object.values(_.omit(sample.files, ['lastModified']));

      await Promise.all(
        files.map(async (file) => {
          try {
            const sampleFileUuid = uuidv4();

            await helper.sqlInsertSampleFile(sampleFileUuid, projectUuid, sample, file);

            await helper.sqlInsertSampleToSampleFileMap(sampleFileUuid, sample);
          } catch (e) {
            console.log(`Error sample_file exp: ${experimentId}, sample: ${sample.uuid}, file: ${file.name}`)
            console.log(e);
          }
        })
      );
    })
  );

  // We can pick the metadata tracks from any sample, any of them has a reference to every metadata track
  const metadataTracks = Object.keys(samples[0].metadata);

  await Promise.all(
    metadataTracks.map(async (metadataTrack) => {
      await helper.sqlInsertMetadataTrack(metadataTrack, experimentId);

      await Promise.all(
        samples.map(async (sample) => {
          await helper.sqlInsertSampleInMetadataTrackMap(metadataTrack, sample);
        })
      );
    })
  );
}

const migrateProjects = async (projects, helper) => {
  await Promise.all(
    projects.map(async (p) => (
      await migrateProject(p, helper)
    ))
  )
}

const migrateUserAccess = async (sqlClient, userAccess) => {
  userAccess.forEach(async (ua) => {
    const sqlUserAccess = {
      user_id: ua.userId,
      experiment_id: ua.experimentId,
      access_role: ua.role,
      updated_at: ua.createdDate

    };

    await sqlClient('user_access').insert(sqlUserAccess);
  });
}

const migrateInviteAccess = async (sqlClient, inviteAccess) => {
  inviteAccess.forEach(async (ia) => {
    const sqlAccess = {
      user_email: ia.userEmail,
      experiment_id: ia.experimentId,
      access_role: ia.role,
      updated_at: ia.createdDate

    };

    await sqlClient('invite_access').insert(sqlAccess);
  });
}

const run = async () => {
  sqlClient = await createSqlClient();

  const helper = new Helper(sqlClient);

  await Promise.all([
    migrateProjects(projectsJson, helper),
    migrateUserAccess(sqlClient, userAccessJson.slice(0, 1)),
    migrateInviteAccess(sqlClient, inviteAccessJson)
  ]);
};

run()
  .then(() => {
    console.log('---------------------------------------------------------');
    console.log('                     finished');
    console.log('---------------------------------------------------------');
  }).catch((e) => console.log(e));