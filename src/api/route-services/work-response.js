const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Validator = require('swagger-model-validator');
const AWS = require('aws-sdk');

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
    this.s3 = new AWS.S3();
  }

  async processS3PathType(workResponse) {
    const s3Promises = [];

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

        s3Promises.push(this.s3.getObject(params).promise());
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
    Promise.all(
      [this.processS3PathType(this.workResponse), this.processInlineType(this.workResponse)],
    ).then((results) => {
      const responseForClient = this.workResponse;
      responseForClient.results = results.flat();

      return responseForClient;
    }).then((response) => {
      this.io.to(response.socketId).emit(`WorkResponse-${response.uuid}`, response);
    });
  }
}

module.exports = WorkResponseService;
