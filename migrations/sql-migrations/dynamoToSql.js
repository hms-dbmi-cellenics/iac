const _ = require('lodash');

const AWS = require('aws-sdk');

const knexfileLoader = require('./knexfile');
const knex = require('knex');

const { v4: uuidv4 } = require('uuid');

// ----------------------Dynamo dumps----------------------
const projectsJson = require('./downloaded_data/projects-production.json');
const experimentsJson = require('./downloaded_data/experiments-production.json');
const samplesJson = require('./downloaded_data/samples-production.json');
const userAccessJson = require('./downloaded_data/user-access-production.json');
const inviteAccessJson = require('./downloaded_data/invite-access-production.json');
const plotsJson = require('./downloaded_data/plots-tables-production.json');

// ----------------------Dynamo dumps END------------------

const environments = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
};

const activeEnvironment = environments.DEVELOPMENT;

const getSqlClient = async () => {
  const knexfile = await knexfileLoader(activeEnvironment);
  return knex.default(knexfile[activeEnvironment]);
}

// ------------------- Utils -------------------------- 
const sampleFileTypeDynamoToEnum = {
  'features.tsv.gz': 'features10x',
  'barcodes.tsv.gz': 'barcodes10x',
  'matrix.mtx.gz': 'matrix10x',
}

const sqlInsertExperiment = async (experimentId, projectData, experimentData) => {
  const sqlClient = await getSqlClient();

  const sqlExperiment = {
    id: experimentId,
    name: projectData.name,
    description: projectData.description,
    processing_config: experimentData.processingConfig,
    created_at: projectData.createdDate,
    updated_at: projectData.lastModified,
    notify_by_email: experimentData.notifyByEmail,
  };

  await sqlClient('experiment').insert(sqlExperiment);
}

const sqlInsertExperimentExecutionGem2s = async (experimentId, experimentData) => {
  const { paramsHash, stateMachineArn, executionArn } = experimentData.meta.gem2s;

  const sqlExperimentExecution = {
    experiment_id: experimentId,
    pipeline_type: 'gem2s',
    params_hash: paramsHash,
    state_machine_arn: stateMachineArn,
    execution_arn: executionArn,
  };

  await sqlClient('experiment_execution').insert(sqlExperimentExecution);
};

const sqlInsertExperimentExecutionQC = async (experimentId, experimentData) => {
  const { stateMachineArn, executionArn } = experimentData.meta.pipeline;

  const sqlExperimentExecution = {
    experiment_id: experimentId,
    pipeline_type: 'qc',
    // QC doesn't have paramsHash (it isn't needed)
    params_hash: null,
    state_machine_arn: stateMachineArn,
    execution_arn: executionArn,
  };

  await sqlClient('experiment_execution').insert(sqlExperimentExecution);
};

const sqlInsertSample = async (experimentId, sample) => {
  const sqlSample = {
    id: sample.uuid,
    experiment_id: experimentId,
    name: sample.name,
    sample_technology: '10x',
    created_at: sample.createdDate,
    updated_at: sample.lastModified,
  };
  
  await sqlClient('sample').insert(sqlSample);
};

const sqlInsertSampleFile = async (sampleFileUuid, projectUuid, sample, file) => {
  const sampleFileTypeEnumKey = sampleFileTypeDynamoToEnum[file.name];
  
  const s3Path = `${projectUuid}/${sample.uuid}/${file.name}`;

  // SQL "sample_file" table
  const sqlSampleFile = {
    id: sampleFileUuid,
    sample_file_type: sampleFileTypeEnumKey,
    valid: file.valid,
    s3_path: s3Path,
    bundle_path: file.path,
    upload_status: file.upload.status,
    updated_at: file.lastModified
  };

  await sqlClient('sample_file').insert(sqlSampleFile);     
};

const sqlInsertSampleToSampleFileMap = async (sampleFileUuid, sample) => {
  const sqlSampleToSampleFile = {
    sample_id: sample.uuid,
    sample_file_id: sampleFileUuid,
  }
  
  await sqlClient('sample_to_sample_file_map').insert(sqlSampleToSampleFile);
}

const sqlInsertMetadataTrack = async (metadataTrack, experimentId) => {
  const sqlMetadataTrack = {
    metadata_track_key: metadataTrack,
    experiment_id: experimentId,
  }

  await sqlClient('metadata_track').insert(sqlMetadataTrack);
}

const sqlInsertSampleInMetadataTrackMap = async (metadataTrack, sample) => {
  const sqlSampleInMetadataTrackMap = {
    metadata_track_key: metadataTrack,
    sample_id: sample.uuid,
    value: sample.metadata[metadataTrack],
  };

  await sqlClient('sample_in_metadata_track_map').insert(sqlSampleInMetadataTrackMap);
}
// ------------------- Utils END----------------------- 

const migrateProject = async (sqlClient, project) => {
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

  // SQL tables we will need to upload into:
  //
  //  dynamo experiments and projects:
  //    - experiment
  //    - experiment_execution
  //
  //  dynamo samples:
  //    - sample
  //    – sample_file
  //    - sample_to_sample_file_map
  //    - metadata_track
  //    - sample_in_metadata_track_map
  //
  // Separate tables to insert into with their dynamo counterparts:
  // - invite_access
  // - user_access
  // - plot
  
  await sqlInsertExperiment(experimentId, projectData, experimentData);

  // Create experiment executions if we need to
  if (!_.isNil(experimentData.meta.gem2s)) {
    await sqlInsertExperimentExecutionGem2s(experimentId, experimentData);
  }

  if (!_.isNil(experimentData.meta.pipeline)) {
    await sqlInsertExperimentExecutionQC(experimentId, experimentData);
  }

  // Samples migrations
  const samples = Object.values(sampleData.samples);
  if (samples.length === 0) {
    console.log(`No samples in the project ${projectUuid}, experiment ${experimentId}`)
  }

  await Promise.all(
    samples.map(async (sample) => {

      await sqlInsertSample(experimentId, sample);

      const files = Object.values(_.omit(sample.files, ['lastModified']));

      await Promise.all(
        files.map(async (file) => {
          try {
            const sampleFileUuid = uuidv4();

            await sqlInsertSampleFile(sampleFileUuid, projectUuid, sample, file);

            await sqlInsertSampleToSampleFileMap(sampleFileUuid, sample);
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
      await sqlInsertMetadataTrack(metadataTrack, experimentId);

      await Promise.all(
        samples.map(async (sample) => {
          await sqlInsertSampleInMetadataTrackMap(metadataTrack, sample);
        })
      );
    })
  );
}

const migrateProjects = async (sqlClient, projects) => {

  projects.forEach( async (p) => await migrateProject(sqlClient, p))
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
  const sqlClient = await getSqlClient();

  await Promise.all([
    migrateProjects(sqlClient, projectsJson),
    migrateUserAccess(sqlClient, userAccessJson.slice(0, 1)),
    migrateInviteAccess(sqlClient, inviteAccessJson)
  ]);
};

run()
  .then(() => console.log('finished'))
  .catch((e) => console.log(e));