const fs = require('fs');
const path = require('path');
const Validator = require('swagger-model-validator');
const yaml = require('js-yaml');

const validateRequest = (request, schemaName) => {
  const specPath = path.resolve(__dirname, '..', 'specs', 'api.yaml');
  const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
  const validator = new Validator();

  const res = validator.validate(
    request, specObj.components.schemas[schemaName], specObj.components.schemas,
  );

  if (!res.valid) {
    throw new Error(res.errors);
  }
};

module.exports = validateRequest;
