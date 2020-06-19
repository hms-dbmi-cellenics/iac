const yaml = require('js-yaml');
const Validator = require('swagger-model-validator');
const fs = require('fs');
const path = require('path');
const WorkSubmitService = require('../general-services/work-submit');

class WorkRequestService {
  constructor(workRequest) {
    const specPath = path.resolve(__dirname, '..', '..', 'specs', 'api.yaml');
    const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
    const validator = new Validator();

    const res = validator.validate(
      workRequest, specObj.components.schemas.WorkRequest, specObj.components.schemas,
    );

    if (!res.valid) {
      throw new Error(res.errors);
    }

    const { timeout } = workRequest;
    if (Date.parse(timeout) <= Date.now()) {
      throw new Error(`Work request will not be handled as timeout of ${timeout} is in the past...`);
    }

    this.workRequest = workRequest;
  }

  handleRequest() {
    const workSubmitService = new WorkSubmitService(this.workRequest);
    console.warn('submitting request...');
    workSubmitService.submitWork();
  }
}

module.exports = WorkRequestService;
