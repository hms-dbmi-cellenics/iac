const _ = require('lodash');

const AWS = require('aws-sdk');

const knexfileLoader = require('./knexfile');
const knex = require('knex');


// ----------------------Dynamo dumps----------------------
const projects = require('projects');
const experiments = require('experiments');
const samples = require('samples');
// ----------------------Dynamo dumps END------------------

const getSqlClient = async () => {
  const knexfile = await knexfileLoader('staging');
  return knex.default(knexfile['staging']);
}

const run = async () => {
  projects.forEach((project) => {
    const { projectUuid } = project;
    const projectData = project.projects[projectUuid];
    
    const experimentId = projectData.experiments[0];
    const experimentData = _.find(experiments, { 'experimentId': experimentId });

    const sampleData = _.find(samples, { 'experimentId': experimentId });

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

    sqlClient('experiment').insert(sqlExperiment);

    // Create experiment executions if we need to
    if (!_.isNil(experimentData.meta.gem2s)) {
      const sqlExperimentExecution = {
        experiment_id: experimentId,
        pipeline_type: 'gem2s',

      };
    }

    if (!_.isNil(experimentData.meta.pipeline)) {

    }

    // experiment_execution:
    // - experiment_id (uuid, FK on experiment)
    // - pipeline_type (enum(pipeline_type))
    // - params_hash (string)
    // - state_machine_arn (string)
    // - execution_arn (string)
    


  });
};

run()
  .then(() => console.log('finished'))
  .catch((e) => console.log(e));