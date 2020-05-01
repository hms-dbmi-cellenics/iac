const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Validator = require('swagger-model-validator');

class WorkResponseService {
  constructor(workResponse) {
    const specPath = path.resolve(__dirname, '..', 'specs', 'api.yaml');
    const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
    const validator = new Validator();

    const res = validator.validate(workResponse, specObj.components.schemas.WorkResponse, specObj.components.schemas);

    if (!res.valid) {
      throw new Error('Supplied response is not a valid WorkResponse:', res.errors);
    }

    console.log('Valid work:', workResponse);
  }
}

module.exports = WorkResponseService;
