const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Validator = require('swagger-model-validator');
const AWS = require('aws-sdk');
const logger = require('../../utils/logging');
const { cacheSetResponse } = require('../../utils/cache-request');
const { handlePagination } = require('../../utils/handlePagination');

class WorkResponseService {
  constructor(io, workResponse) {
    const specPath = path.resolve(__dirname, '..', '..', 'specs', 'api.yaml');
    const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
    const validator = new Validator();

    const res = validator.validate(
      workResponse, specObj.components.schemas.WorkResponse, specObj.components.schemas,
    );

    if (!res.valid) {
      throw new Error(res.errors);
    }

    this.workResponse = workResponse;
    this.io = io;
  }

  // eslint-disable-next-line class-methods-use-this
  async processS3PathType(workResponse) {
    logger.log('processs3pathtype called');

    const s3Promises = [];
    const s3 = new AWS.S3();

    workResponse.results
      .filter((result) => result.type === 's3-path')
      .forEach((result) => {
        const fullPath = result.body.split('/');

        const params = {
          Bucket: fullPath[0],
          Key: fullPath.slice(1).join('/'),
          ResponseContentType: result['content-type'],
          ResponseContentEncoding: result['content-encoding'] || 'utf-8',
        };

        s3Promises.push(s3.getObject(params).promise());
      });

    const result = await Promise.all(s3Promises).then((values) => {
      const processed = [];

      values.forEach((value) => {
        processed.push({
          'content-type': value.ContentType,
          'content-encoding': value.ContentEncoding,
          body: value.Body.toString(value.ContentEncoding),
        });
      });

      return processed;
    });

    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  async processInlineType(workResponse) {
    logger.log('processInlineType called');
    const inlineResults = workResponse.results
      .filter((result) => result.type === 'inline')
      .map((result) => {
        // eslint-disable-next-line no-param-reassign
        delete result.type;
        return result;
      });

    return inlineResults;
  }

  async handleResponse() {
    let processedResults = await Promise.all(
      [this.processS3PathType(this.workResponse), this.processInlineType(this.workResponse)],
    );

    processedResults = processedResults.flat();

    const responseForClient = this.workResponse;
    responseForClient.results = processedResults;

    const {
      uuid, socketId, timeout, pagination,
    } = responseForClient.request;

    try {
      await cacheSetResponse(responseForClient);
      // Order results according to the pagination
      if (pagination) {
        responseForClient.results = handlePagination(processedResults, pagination);
      }

      if (Date.parse(timeout) > Date.now()) {
        this.io.to(socketId).emit(`WorkResponse-${uuid}`, responseForClient);
      }

      logger.log('response sent out');
    } catch (e) {
      logger.error('Error trying to cache or paginate data: ', e);
    }
  }
}

module.exports = WorkResponseService;
