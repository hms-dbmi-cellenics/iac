const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');

const DOWNLOAD_FOLDER = '../downloaded_data'

const Helper = require('./Helper');

const env = process.env.SOURCE_ENV || 'production'
const { v4: uuidv4 } = require('uuid');

// ----------------------Dynamo dumps----------------------
const projectsJson = require(`${DOWNLOAD_FOLDER}/projects-${env}.json`);
const experimentsJson = require(`${DOWNLOAD_FOLDER}/experiments-${env}.json`);
const samplesJson = require(`${DOWNLOAD_FOLDER}/samples-${env}.json`);
const userAccessJson = require(`${DOWNLOAD_FOLDER}/user-access-${env}.json`);
const inviteAccessJson = require(`${DOWNLOAD_FOLDER}/invite-access-${env}.json`);
const plotsJson = require(`${DOWNLOAD_FOLDER}/plots-tables-${env}.json`);
// ----------------------Dynamo dumps END------------------
const createSqlClient = async (activeEnvironment, sandboxId) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId);
  return knex.default(knexfile[activeEnvironment]);
}

const migrateProject = async (project, helper) => {
  const { projectUuid, projects: projectData } = project;
  const experimentId = projectData.experiments[0];
  const experimentData = _.find(experimentsJson, { 'experimentId': experimentId });

  const sampleData = _.find(samplesJson, { 'experimentId': experimentId });

  console.log(`Migrating ${projectUuid}, experiment ${experimentId}`);

  if (_.isNil(projectData) || _.isNil(experimentData) || _.isNil(sampleData)) {
    console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
    console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
    console.warn(`[ MALFORMED ] - p: ${projectUuid}, e: ${experimentId} - One of these is nil:`);
    console.log('projectData:')
    console.log(projectData)
    console.log('experimentData: $')
    console.log(experimentData)
    console.log('sampleData: ')
    console.log(sampleData)
    console.log(`Finishing`);    console.log(`Finishing`);
    console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
    console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
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
    console.log(`No samples in the project ${projectUuid}, experiment ${experimentId}, finishing`)
    return;
  }

  // Migrate all samples
  const insertSamplePromise = samples.map(async (sample) => {
    const hasSample = await helper.sqlInsertSample(experimentId, sample);

    if (!hasSample) return;

    const files = Object.entries(_.omit(sample.files, ['lastModified']));

    await Promise.all(
      files.map(async ([fileName, file]) => {
        const sampleFileUuid = uuidv4();

        await helper.sqlInsertSampleFile(sampleFileUuid, projectUuid, sample, fileName, file);

        await helper.sqlInsertSampleToSampleFileMap(sampleFileUuid, sample);
      })
    );
  }).filter(p => p);

  if(!insertSamplePromise.length) return;

  await Promise.all(insertSamplePromise);
  
  if(!samples[0].metadata) {
    console.warn(`[ MALFORMED ] - e: ${experimentId}: Samples do not contain metadata`)
    return;
  }

  // We can pick the metadata tracks from any sample, any of them has a reference to every metadata track
  const metadataTracks = Object.keys(samples[0].metadata);

  await Promise.all(
    metadataTracks.map(async (metadataTrackKey) => {
      const insertedTrack = await helper.sqlInsertMetadataTrack(metadataTrackKey, experimentId);

      await Promise.all(
        samples.map(async (sample) => {
          await helper.sqlInsertSampleInMetadataTrackMap(insertedTrack[0], sample);
        })
      );
    })
  );
}

const migrateProjects = async (projects, helper) => {
  // const project = _.find(projects, {projectUuid: '669dea2a-e87d-4fa0-a072-626d60bd8c2e'});
  // await migrateProject(project, helper);

  await Promise.all(
    projects.map(async (p) => {
      try {
        await migrateProject(p, helper);
      } catch (e) {
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`---------------------------------- Error on project ${p.projectUuid} -------------------------`);
        console.log(e);
        console.log(`------------------------------- END Error on project ${p.projectUuid} ------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        throw e;
      }
    })
  );

  console.log('(`---------------------------------------FINSIHED MIGRATING PROJECTS---------------------------------------------------------`);')
}

const migrateUserAccess = async (sqlClient, userAccess) => {
  await Promise.all(
    userAccess.map(async (ua) => {
      try {
        const experimentData = _.find(experimentsJson, { 'experimentId': ua.experimentId });
        if (_.isNil(experimentData)) {
          console.log(`[ ORPHAN USER ACCESS ]: eId ${ua.experimentId}`);
          console.log('Skipping this one');
          return;
        }

        const sqlUserAccess = {
          user_id: ua.userId,
          experiment_id: ua.experimentId,
          access_role: ua.role,
          updated_at: ua.createdDate
        };
  
        console.log(`Migrating user access ${ua.experimentId}, ${ua.userId}`);
        await sqlClient('user_access').insert(sqlUserAccess);
        console.log(`>>>>>>> Finished migrating user access ${ua.experimentId}, ${ua.userId} <<<<<<<<`);
      } catch (e) {
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`---------------------------------- Error on user access exp ${ua.experimentId} -------------------------`);
        console.log('userAccessDynamoObject:');
        console.log(JSON.stringify(ua));
        console.log('Error:');
        console.log(e);
        console.log(`------------------------------- END Error on user access exp ${ua.experimentId} ------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        throw e;
      }
    })
  );
}

const migrateInviteAccess = async (sqlClient, inviteAccess) => {
  await Promise.all(
    inviteAccess.map(async (ia) => {
      try {
        const experimentData = _.find(experimentsJson, { 'experimentId': ia.experimentId });
        if (_.isNil(experimentData)) {
          console.log(`[ ORPHAN INVITE ACCESS ]: eId ${ia.experimentId}`);
          console.log('Skipping this one');
          return;
        }

        const sqlAccess = {
          user_email: ia.userEmail,
          experiment_id: ia.experimentId,
          access_role: ia.role,
          updated_at: ia.createdDate
  
        };
        
        console.log(`Migrating invite access ${ia.experimentId}, ${ia.userEmail}`);
        await sqlClient('invite_access').insert(sqlAccess);
        console.log(`>>>>>>> Finished migrating invite access ${ia.experimentId}, ${ia.userEmail} <<<<<<<<`);
      } catch (e) {
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`---------------------------------- Error on invite access exp ${ia.experimentId} -------------------------`);
        console.log('inviteAccessDynamoObject:');
        console.log(JSON.stringify(ia));
        console.log('Error:');
        console.log(e);
        console.log(`------------------------------- END Error on invite access exp ${ia.experimentId} ------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        throw e;
      }
    })
  );
}

const migratePlots = async (sqlClient, plots) => {
  await Promise.all(
    plots.map(async (p) => {
      try {
        const experimentData = _.find(experimentsJson, { 'experimentId': p.experimentId });
        if (_.isNil(experimentData)) {
          console.log(`[ ORPHAN PLOT ]: eId ${p.experimentId}, plotUuid ${p.plotUuid}. Skipping this one...`);
          return;
        }
        
        const sql = {
          id: p.plotUuid,
          experiment_id: p.experimentId,
          config: p.config,
          s3_data_key: p.plotDataKey
        };
  
        console.log(`Migrating plot ${p.experimentId}, ${p.plotUuid}`);
        await sqlClient('plot').insert(sql);
        console.log(`>>>>>>> Finished migrating plot ${p.experimentId}, ${p.plotUuid} <<<<<<<<`);
      } catch (e) {
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`---------------------------------- Error on plot exp ${p.experimentId} -------------------------`);
        console.log('plotDynamoObject:');
        console.log(JSON.stringify(p));
        console.log('Error:');
        console.log(e);
        console.log(`------------------------------- END Error on plot exp ${p.experimentId} ------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        console.log(`----------------------------------------------------------------------------------------------------------------`);
        throw e;
      }
    })
  );
}

const run = async (environment, sandboxId) => {
  sqlClient = await createSqlClient(environment);

  const helper = new Helper(sqlClient);

  await migrateProjects(projectsJson, helper);

  await Promise.all([
    migrateUserAccess(sqlClient, userAccessJson),
    migrateInviteAccess(sqlClient, inviteAccessJson),
    migratePlots(sqlClient, plotsJson)
  ]);
};

const environment = process.env.TARGET_ENV;
const sandboxId = process.env.SANDBOX_ID || 'default';

if (!_.isNil(environment)) {
  run(environment, sandboxId)
    .then(() => {
      console.log('>>>>--------------------------------------------------------->>>>');
      console.log('                     finished');
      console.log('>>>>--------------------------------------------------------->>>>');
    }).catch((e) => console.log(e));
} else {
  console.log('You need to specify what environment to run this on.');
  console.log('e.g.: TARGET_ENV=staging npm run dynamoToSql');
}
