const _ = require('lodash');
const knexfileLoader = require('../knexfile');
const knex = require('knex');
const parseArgs = require('minimist');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const getS3Client = require('./getS3Client')
const getBucketNames = require('./getBucketNames')

const DOWNLOAD_FOLDER = '../downloaded_data/aws_to_aws'

// set defaults command line arguments
const opts = {
  default: {
    sandboxId: 'default',
    sourceRegion: 'eu-west-1',
    targetRegion: 'us-east-1',
    targetEnvironment: 'development',
    sourceLocalPort: 5432
  }
}

// get command line arguments
const argv = parseArgs(process.argv.slice(2), opts);

// set target local port
// 5431 for inframock
// 5433 for production target
argv.targetLocalPort = argv.targetLocalPort || (argv.targetEnvironment === 'development' ? 5431 : 5433);

console.log(`Command line arguments:\n=====`)
console.log(JSON.stringify(argv, null, 2))
console.log(`=====\n\n`)

// destructure command line args
const {
  sandboxId,
  sourceEnvironment,
  targetEnvironment,
  sourceRegion,
  targetRegion,
  sourceLocalPort,
  targetLocalPort,
  sourceCognitoUserPoolId,
  targetCognitoUserPoolId,
  targetAdminUserId,
  sourceProfile,
  targetProfile,
  usersToMigrateFile,
  experimentsToMigrate
} = argv;


const getAWSAccountId = async (profile) => {
  const AWS = require('aws-sdk');
  
  // set profile
  const credentials = new AWS.SharedIniFileCredentials({profile});
  AWS.config.credentials = credentials;
  
  
  const sts = new AWS.STS();
  const { Account: accountId } = await sts.getCallerIdentity({}).promise();
  return accountId;
};


const createSqlClient = async (activeEnvironment, sandboxId, region, localPort, profile) => {
  const knexfile = await knexfileLoader(activeEnvironment, sandboxId, region, localPort, profile);
  return knex.default(knexfile[activeEnvironment]);
};

const migrateUser = async (user, sourceSqlClient, targetSqlClient, sourceS3Client, targetS3Client, sourceBucketNames, targetBucketNames, experimentsToMigrate, experimentExecutionConfig, targetAdminUserId, indexString) => {
  const { sourceUserId, targetUserId, email } = user;
  
  console.log(`\n==========\nMigrating User: ${email} ${indexString}\n`,)
  
  // get all experiment_id's for user
  const sourceUserAccessEntries = await sourceSqlClient('user_access')
  .where('user_id', sourceUserId);
  
  // change user_id to target 
  // and proceed only with experiments requested
  const targetUserAccessEntries = sourceUserAccessEntries
  .map(entry => ({ ...entry, user_id: targetUserId }))
  .filter(entry => experimentsToMigrate === 'all' || entry.experiment_id === experimentsToMigrate )
  
  
  for (const currentUserAccessEntry of targetUserAccessEntries) {
    const { experiment_id: experimentId } = currentUserAccessEntry;
    
    console.log(`Migrating experimentId: ${experimentId}`)
    
    // migrate experiment table
    await migrateExperiment(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): experiment [✓]')
    
    // migrate experiment_execution table
    await migrateExperimentExecution(experimentId, sourceSqlClient, targetSqlClient, experimentExecutionConfig);
    console.log('\t- table(s): experiment_execution [✓]')
    
    // migrate sample, sample_file, and sample_to_sample_file_map tables
    const { sourceSampleFileS3Paths, sourceSampleIds } = await migrateSamples(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): sample, sample_file, sample_to_sample_file_map [✓]')
    
    // migrate sample s3 files
    await migrateS3Files(sourceSampleFileS3Paths, targetS3Client, sourceBucketNames.SAMPLE_FILES, targetBucketNames.SAMPLE_FILES);
    console.log('\t- s3 path(s) in table: sample_file [✓]')
    
    // migrate metadata_track and sample_in_metadata_track_map tables
    await migrateMetadata(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): metadata_track, sample_in_metadata_track_map [✓]')
    
    // migrate plot table
    const sourceS3DataKeys = await migratePlots(experimentId, sourceSqlClient, targetSqlClient);
    console.log('\t- table(s): plot [✓]')
    
    // migrate plot s3 files
    // for testing
    await migrateS3Files(sourceS3DataKeys, targetS3Client, sourceBucketNames.PLOTS, targetBucketNames.PLOTS);
    console.log('\t- s3 path(s) in table: plot [✓]')
    
    // migrate processed data files
    const processedS3FilesParams = await getProcessedS3FilesParams(experimentId, sourceBucketNames, targetBucketNames, sourceSampleIds, sourceS3Client);
    await migrateS3FilesFromParams(processedS3FilesParams, targetS3Client);
    console.log('\t- s3 file(s) from buckets: cell-sets, processed-matrix, source, filtered-cells [✓]')
    
    // insert entries into user_acess table on target
    // experiment table entries (migrateExperiment above) need to be present before user_access
    
    sqlInsert(targetSqlClient, [currentUserAccessEntry], 'user_access')
    console.log('\t- table(s): user_access owner [✓]')
    
    // insert admin role
    const currentAdminAccessEntry = { ...currentUserAccessEntry, user_id: targetAdminUserId, access_role: 'admin' };
    sqlInsert(targetSqlClient, [currentAdminAccessEntry], 'user_access')
    console.log('\t- table(s): user_access admin [✓]')
  }
  
  console.log(`Finished Migrating User: ${email} \n==========\n`)
};

const getProcessedS3FilesParams = async (experimentId, sourceBucketNames, targetBucketNames, sourceSampleIds, sourceS3Client) => {
  
  const candidateProcessedS3FilesParams = [
    { sourceBucket: sourceBucketNames.CELL_SETS, targetBucket: targetBucketNames.CELL_SETS, Key: experimentId },
    { sourceBucket: sourceBucketNames.PROCESSED_MATRIX, targetBucket: targetBucketNames.PROCESSED_MATRIX, Key: `${experimentId}/r.rds` },
    { sourceBucket: sourceBucketNames.RAW_SEURAT, targetBucket: targetBucketNames.RAW_SEURAT, Key: `${experimentId}/r.rds` },
  ]
  
  // add filtered cells objects for each QC pipeline step
  const filteredFolderNames = ['cellSizeDistribution', 'dataIntegration', 'doubletScores', 'mitochondrialContent', 'numGenesVsNumUmis']
  sourceSampleIds.forEach(sampleId => {
    filteredFolderNames.forEach(folderName => {
      
      candidateProcessedS3FilesParams.push({
        sourceBucket: sourceBucketNames.FILTERED_CELLS,
        targetBucket: targetBucketNames.FILTERED_CELLS,
        Key: `${experimentId}/${folderName}/${sampleId}.rds`
      });
      
    });
  });
  
  // remove objects that don't exist in source: aka data processing hasn't been run
  const doesS3FileExist = await Promise.all(
    candidateProcessedS3FilesParams.map(({ Key, sourceBucket }) => {
      return checkIfS3FileExists(Key, sourceBucket, sourceS3Client);
    })
    );
    
    const processedS3FilesParams = candidateProcessedS3FilesParams.filter((_, i) => doesS3FileExist[i])
    return processedS3FilesParams;
  }
  
  const migratePlots = async (experimentId, sourceSqlClient, targetSqlClient) => {
    
    // migrate plot table
    // ----
    // get source entries
    const sourcePlotEntries = await sourceSqlClient('plot')
    .where('experiment_id', experimentId);
    
    
    // insert into target
    await sqlInsert(targetSqlClient, sourcePlotEntries, 'plot');
    
    // need s3 data keys to migrate files in S3
    const sourceS3DataKeys = sourcePlotEntries.map(entry => entry.s3_data_key);
    return sourceS3DataKeys;
  };
  
  const migrateSamples = async (experimentId, sourceSqlClient, targetSqlClient) => {
    
    // migrate sample table
    // ----
    // get source entries
    const sourceSampleEntries = await sourceSqlClient('sample')
    .where('experiment_id', experimentId);
    
    // insert into target
    await sqlInsert(targetSqlClient, sourceSampleEntries, 'sample');
    
    // migrate sample_to_sample_file_map table
    // ----
    const sourceSampleIds = sourceSampleEntries.map(entry => entry.id);
    
    const sourceSampleToSamplesFileMapEntries = await sourceSqlClient('sample_to_sample_file_map')
    .whereIn('sample_id', sourceSampleIds);
    
    // migrate sample_file table
    // ----
    const sourceSampleFileIds = sourceSampleToSamplesFileMapEntries.map(entry => entry.sample_file_id)
    
    const sourceSampleFileEntries = await sourceSqlClient('sample_file')
    .whereIn('id', sourceSampleFileIds);
    
    await sqlInsert(targetSqlClient, sourceSampleFileEntries, 'sample_file');
    
    // insert into sample_to_sample_file_map has to happen AFTER sample_file entry insertion
    await sqlInsert(targetSqlClient, sourceSampleToSamplesFileMapEntries, 'sample_to_sample_file_map');
    
    // paths to migrate sample_file s3 objects
    const sourceSampleFileS3Paths = sourceSampleFileEntries.map(entry => entry.s3_path);
    
    return {
      sourceSampleFileS3Paths,
      sourceSampleIds
    };
  };
  
  const checkIfS3FileExists = async (Key, Bucket, s3Client) => {
    if (Key == null) return true;
    
    // check if destination already has object
    let s3FileExists;
    try {
      await s3Client.headObject({ Bucket, Key }).promise();
      s3FileExists = true;
      
    } catch (error) {
      if (error.name === 'NotFound') {
        s3FileExists = false;
        
      } else {
        throw error;
      }
    }
    
    return s3FileExists;
  }
  
  const migrateS3Files = async (s3Paths, targetS3Client, sourceBucket, targetBucket) => {
    if (!s3Paths.length) return;
    
    s3Paths.map(async (Key) => await migrateS3File(Key, targetS3Client, sourceBucket, targetBucket))
    
  };
  
  const migrateS3FilesFromParams = async (S3FilesParams, targetS3Client) => {
    
    for (const {Key, sourceBucket, targetBucket} of S3FilesParams) {
      await migrateS3File(Key, targetS3Client, sourceBucket, targetBucket)
    }
    
  };
  
  const makeid = (length) => {
    let result             = '';
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  const migrateS3File = async (Key, targetS3Client, sourceBucket, targetBucket) => {
    const s3FileExists = await checkIfS3FileExists(Key, targetBucket, targetS3Client);
    if (s3FileExists) {
      console.log(`\tObject ${Key} already exists in target. Skipping.`);
      return;
    }
    
    const sourceParams = {
      Bucket: sourceBucket,
      Key
    }
    const fname = makeid(33);
    console.log(`\tGetting ${Key} from sourceBucket: ${sourceBucket}.`)
    await exec(`aws s3 cp s3://${sourceBucket}/${Key} temp/${fname} --profile ${sourceProfile} --no-progress`)

    console.log(`\tPutting ${Key} into targetBucket: ${targetBucket}.`)
    await exec(`aws s3 cp temp/${fname} s3://${targetBucket}/${Key} --profile ${targetProfile} --no-progress`)

    await exec(`rm temp/${fname}`)
 
  }
  
  
  const migrateExperiment = async (experimentId, sourceSqlClient, targetSqlClient) => {
    
    const sourceExperimentTableEntries = await sourceSqlClient('experiment')
    .where('id', experimentId);
    
    // stringify necessary values
    const targetExperimentTableEntries = sourceExperimentTableEntries.map(entry => {
      return {
        ...entry,
        processing_config: JSON.stringify(entry.processing_config),
        samples_order: JSON.stringify(entry.samples_order)
      }
    })
    
    // delete it if already on target
    await sqlDelete(targetSqlClient, 'id', experimentId, 'experiment');
    
    // insert
    await sqlInsert(targetSqlClient, targetExperimentTableEntries, 'experiment');
    
  };
  
  const migrateExperimentExecution = async (experimentId, sourceSqlClient, targetSqlClient, experimentExecutionConfig) => {
    
    const sourceExperimentExecutionTableEntries = await sourceSqlClient('experiment_execution')
    .where('experiment_id', experimentId);
    
    const {sourceAccountId, targetAccountId, sourceRegion, targetRegion} = experimentExecutionConfig;
    
    // exclude entries that failed (will prompt to "Process project")
    const noExperimentExecutionErrors = sourceExperimentExecutionTableEntries.every(entry => {
      if (entry.last_status_response == null) return true;
      
      const key = Object.keys(entry.last_status_response)[0];
      const result = entry.last_status_response[key].status !== 'FAILED';
      return result;
    })
    
    if (!noExperimentExecutionErrors) {
      console.log('Experiment execution errors: will be prompted to "Process project".')
      return;
    }
    
    const targetExperimentExecutionTableEntries = sourceExperimentExecutionTableEntries
    // stringify necessary values
    .map(entry => {
      
      return {
        ...entry,
        last_status_response: JSON.stringify(entry.last_status_response)
      }
    })
    // replace source region/account id with target values
    .map(entry => {
      const stateMachineArn = entry
      .state_machine_arn
      .replace(sourceAccountId, targetAccountId)
      .replace(sourceRegion, targetRegion);
      
      const executionArn = entry
      .execution_arn
      .replace(sourceAccountId, targetAccountId)
      .replace(sourceRegion, targetRegion);
      
      return {
        ...entry,
        state_machine_arn: stateMachineArn,
        execution_arn: executionArn
      }
    })
    
    // insert
    await sqlInsert(targetSqlClient, targetExperimentExecutionTableEntries, 'experiment_execution');
  };
  
  const migrateMetadata = async (experimentId, sourceSqlClient, targetSqlClient) => {
    
    // migrate metadata_track table
    // ----
    // get source entries
    const sourceMetadataTrackEntries = await sourceSqlClient('metadata_track')
    .where('experiment_id', experimentId);
    
    
    // insert into target
    await sqlInsert(targetSqlClient, sourceMetadataTrackEntries, 'metadata_track');
    
    // migrate sample_in_metadata_track_map table
    // ----
    const sourceMetadataTrackIds = sourceMetadataTrackEntries.map(entry => entry.id);
    
    for (const metadataTrackId of sourceMetadataTrackIds) {
      
      const sourceSampleInMetadataTrackMapEntries = await sourceSqlClient('sample_in_metadata_track_map')
      .where('metadata_track_id', metadataTrackId);
      
      // insert into target
      await sqlInsert(targetSqlClient, sourceSampleInMetadataTrackMapEntries, 'sample_in_metadata_track_map');
    };
  };
  
  const getUsersToMigrate = (sourceCognitoUsers, targetCognitoUsers, createdUserEmails) => {
    
    // only migrate source users that have email in createdUserEmails
    const usersToMigrate = sourceCognitoUsers
    .filter(user => {
      const emailAttribute = user.Attributes.filter(attr => attr.Name == "email");
      return createdUserEmails.includes(emailAttribute[0].Value);
    })
    // only keep attributes: has all needed values and is flat
    .map(user => {
      const flatAttributes = {};
      user.Attributes.forEach(attr => flatAttributes[attr.Name] = attr.Value);
      return flatAttributes;
    });
    
    // get map from user_id to email for targetCognitoUsers
    const targetCognitoUsersMap = {};
    
    targetCognitoUsers
    .forEach(user => {
      const flatAttributes = {};
      user.Attributes.forEach(attr => flatAttributes[attr.Name] = attr.Value);
      targetCognitoUsersMap[flatAttributes.email] = user.Username;
    });
    
    // add targetUserId to usersToMigrate
    // also change "sub" to sourceUserId
    usersToMigrate.forEach((user, index) => {
      usersToMigrate[index]['targetUserId'] = targetCognitoUsersMap[user.email];
      usersToMigrate[index]['sourceUserId'] = usersToMigrate[index]['sub'];
      delete usersToMigrate[index]['sub'];
    });
    
    return usersToMigrate;
  };
  
  const sqlInsert = async (sqlClient, sqlObject, tableName, extraLoggingData = {}) => {
    
    if (!sqlObject.length) {
      // console.log(`nothing to insert: ${sqlObject}`);
      return;
    } 
    
    try {
      return await sqlClient(tableName).insert(sqlObject).returning('*');
    } catch (e) {
      throw new Error(
        `
        ----------------------
        -------------------
        Error inserting this object in ${tableName}:
        sqlObject: ${JSON.stringify(sqlObject)}
        -------------------
        Original Error: ${e}
        -------------------
        ----------------------
        extraLoggingData: ${JSON.stringify(extraLoggingData)}
        `
        );
      }
    };
    
    const sqlDelete = async (sqlClient, queryColumn, queryValue, tableName, extraLoggingData = {}) => {
      try {
        return await sqlClient(tableName).del().where(queryColumn, queryValue);
      } catch (e) {
        throw new Error(
          `
          ----------------------
          -------------------
          Error deleting from ${tableName}:
          queryColumn: ${queryColumn}
          queryValue: ${queryValue}
          -------------------
          Original Error: ${e}
          -------------------
          ----------------------
          extraLoggingData: ${JSON.stringify(extraLoggingData)}
          `
          );
        }
      };
      
      const run = async (usersToMigrate, sandboxId, sourceEnvironment, targetEnvironment, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort, sourceProfile, targetProfile, experimentsToMigrate, targetAdminUserId) => {
        
        // need for experiment_execution migration
        const sourceAccountId = await getAWSAccountId(sourceProfile);
        const targetAccountId = await getAWSAccountId(targetProfile);
        
        
        const experimentExecutionConfig = {
          sourceRegion, targetRegion, sourceAccountId, targetAccountId
        }
        
        
        // where users will be migrated from
        let sourceSqlClient = await createSqlClient(sourceEnvironment, sandboxId, sourceRegion, sourceLocalPort, sourceProfile);
        const sourceS3Client = getS3Client(sourceProfile, sourceRegion, sourceEnvironment);
        const sourceBucketNames = await getBucketNames(sourceProfile, sourceEnvironment);
        
        // where users will be migrated to
        let targetSqlClient = await createSqlClient(targetEnvironment, sandboxId, targetRegion, targetLocalPort, targetProfile);
        const targetS3Client = getS3Client(targetProfile, targetRegion, targetEnvironment);
        const targetBucketNames = await getBucketNames(targetProfile, targetEnvironment);
        
        // migrate each user
        for (const [index, userToMigrate] of usersToMigrate.entries()) {
          const indexString = `(${index}/${usersToMigrate.length})`;
          
          let tryIndex = 0;
          while (tryIndex < 3) {
            try {
              await migrateUser(userToMigrate, sourceSqlClient, targetSqlClient, sourceS3Client, targetS3Client, sourceBucketNames, targetBucketNames, experimentsToMigrate, experimentExecutionConfig, targetAdminUserId, indexString);
              break;
              
            } catch (error) {
              console.log(error);
              tryIndex += 1;
              
              // regenerate sql clients (to handle PAM authentication failed for user "dev_role")
              sourceSqlClient = await createSqlClient(sourceEnvironment, sandboxId, sourceRegion, sourceLocalPort, sourceProfile);
              targetSqlClient = await createSqlClient(targetEnvironment, sandboxId, targetRegion, targetLocalPort, targetProfile);
              
              if (tryIndex === 3) console.log(`Skipping user ${userToMigrate.email}! Check manually!!!!`)
            }
          }
        };
      };
      
      if (!sourceCognitoUserPoolId) {
        console.log('You need to specify the sourceCognitoUserPoolId.');
        console.log('e.g.: npm run migrateUsersToAccount -- --sourceCognitoUserPoolId eu-west-1_abcd1234');
        
      } else if (!targetCognitoUserPoolId) {
        console.log('You need to specify the targetCognitoUserPoolId.');
        console.log('e.g.: npm run migrateUsersToAccount -- --targetCognitoUserPoolId us-east-1_abcd1234');
        
      } else if (!sourceEnvironment) {
        console.log('You need to specify what source environment to migrate from.');
        console.log('e.g.: npm run migrateUsersToAccount -- --sourceEnvironment=staging');
        
      } else if (!sourceProfile) {
        console.log('You need to specify the aws profile to use for the source account.');
        console.log('e.g.: npm run migrateUsersToAccount -- --sourceProfile default');
        
      } else if (!targetProfile && !targetEnvironment === 'development') {
        console.log('You need to specify the aws profile to use for the target account.');
        console.log('e.g.: npm run migrateUsersToAccount -- --targetProfile hms');
        
      } else if (!usersToMigrateFile) {
        console.log(`You need to specify a filename in ${DOWNLOAD_FOLDER} with emails to migrate.`);
        console.log('Example file format (json): [{"email":"blah@blah.com"}, {...}]');
        console.log('e.g.: npm run migrateUsersToAccount -- --usersToMigrateFile users_to_migrate.json');
        
      } else if (!experimentsToMigrate) {
        console.log('You need to specify experimentsToMigrate (options: "all" or a single experiment id).');
        console.log('e.g.: npm run migrateUsersToAccount -- --experimentsToMigrate abc1234defgh');
        
      } else if (!targetAdminUserId) {
        console.log('You need to specify targetAdminUserId.');
        console.log('e.g.: npm run migrateUsersToAccount -- --targetAdminUserId abcd-01ef-234567ghi');
        
      } else {
        // ----------------------Cognito dumps----------------------
        let sourceCognitoUsers, targetCognitoUsers;
        try {
          sourceCognitoUsers = require(`${DOWNLOAD_FOLDER}/${sourceCognitoUserPoolId}.json`);
          targetCognitoUsers = require(`${DOWNLOAD_FOLDER}/${targetCognitoUserPoolId}.json`);
        } catch (error) {
          throw new Error('Need to run cognito_to_json.js for both source and target user pools.')
        }
        
        const createdUserEmails = require(`${DOWNLOAD_FOLDER}/${usersToMigrateFile}`).map(user => user.email);
        // ----------------------Cognito dumps----------------------
        
        const usersToMigrate = getUsersToMigrate(sourceCognitoUsers, targetCognitoUsers, createdUserEmails);
        
        
        run(usersToMigrate, sandboxId, sourceEnvironment, targetEnvironment, sourceRegion, targetRegion, sourceLocalPort, targetLocalPort, sourceProfile, targetProfile, experimentsToMigrate, targetAdminUserId)
        .then(() => {
          console.log('>>>>--------------------------------------------------------->>>>');
          console.log('                     finished');
          console.log('>>>>--------------------------------------------------------->>>>');
        }).catch((e) => console.log(e));
        
      }
      