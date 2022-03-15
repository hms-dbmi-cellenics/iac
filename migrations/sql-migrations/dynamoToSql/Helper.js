class Helper {
  constructor(sqlClient) {
    this.sqlClient = sqlClient;
  }

  sampleFileTypeDynamoToEnum = {
    'features.tsv.gz': 'features10x',
    'barcodes.tsv.gz': 'barcodes10x',
    'matrix.mtx.gz': 'matrix10x',
  }
  
  sqlInsertExperiment = async (experimentId, projectData, experimentData) => {
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
  
  sqlInsertExperimentExecutionGem2s = async (experimentId, experimentData) => {
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
  
  sqlInsertExperimentExecutionQC = async (experimentId, experimentData) => {
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
  
  sqlInsertSample = async (experimentId, sample) => {
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
  
  sqlInsertSampleFile = async (sampleFileUuid, projectUuid, sample, file) => {
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
  
  sqlInsertSampleToSampleFileMap = async (sampleFileUuid, sample) => {
    const sqlSampleToSampleFile = {
      sample_id: sample.uuid,
      sample_file_id: sampleFileUuid,
    }
    
    await sqlClient('sample_to_sample_file_map').insert(sqlSampleToSampleFile);
  }
  
  sqlInsertMetadataTrack = async (metadataTrack, experimentId) => {
    const sqlMetadataTrack = {
      metadata_track_key: metadataTrack,
      experiment_id: experimentId,
    }
  
    await sqlClient('metadata_track').insert(sqlMetadataTrack);
  }
  
  sqlInsertSampleInMetadataTrackMap = async (metadataTrack, sample) => {
    const sqlSampleInMetadataTrackMap = {
      metadata_track_key: metadataTrack,
      sample_id: sample.uuid,
      value: sample.metadata[metadataTrack],
    };
  
    await sqlClient('sample_in_metadata_track_map').insert(sqlSampleInMetadataTrackMap);
  }
};

module.exports = Helper;