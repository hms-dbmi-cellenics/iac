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
  }

  // eslint-disable-next-line class-methods-use-this
  async processS3PathType(workResponse) {
    console.log('processs3pathtype called');

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
    console.log('processInlineType called');
    const inlineResults = workResponse.results
      .filter((result) => result.type === 'inline')
      .map((result) => {
        // eslint-disable-next-line no-param-reassign
        delete result.type;
        return result;
      });

    return inlineResults;
  }


  handleResponse() {
    return Promise.all(
      [this.processS3PathType(this.workResponse), this.processInlineType(this.workResponse)],
    ).then((results) => {
      const responseForClient = this.workResponse;
      responseForClient.results = results.flat();

      return responseForClient;
    }).then((response) => {
      const { uuid, socketId } = response.request;
      try {
        this.io.to(socketId).emit(`WorkResponse-${uuid}`, response);
      } catch (e) {
        console.error('Error trying to send result over sockets: ', e);
      }

      console.log('response sent out');
    });
  }
}

module.exports = WorkResponseService;
