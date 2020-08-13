const yaml = require('js-yaml');
const Validator = require('swagger-model-validator');
const fs = require('fs');
const path = require('path');
const WorkSubmitService = require('../general-services/work-submit');
const logger = require('../../utils/logging');
const { cacheGetRequest } = require('../../utils/cache-request');
const { handlePagination } = require('../../utils/handlePagination');

const validateRequest = (workRequest) => {
  const specPath = path.resolve(__dirname, '..', '..', 'specs', 'api.yaml');
  const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
  const validator = new Validator();

  const res = validator.validate(
    workRequest, specObj.components.schemas.WorkRequest, specObj.components.schemas,
  );

  if (!res.valid) {
    throw new Error(res.errors);
  }
};

const handleWorkRequest = async (workRequest, socket) => {
  const { uuid, pagination } = workRequest;

  try {
    logger.log(`Trying to fetch response to request ${uuid} from cache...`);
    const cachedResponse = await cacheGetRequest(workRequest);
    logger.log(`We found a cached response for ${uuid}. Checking if pagination is needed...`);

    if (pagination) {
      logger.log('Pagination is needed, processing response...');
      cachedResponse.results = handlePagination(cachedResponse.results, pagination);
      logger.log('Paginated');
    }
    socket.emit(`WorkResponse-${uuid}`, cachedResponse);
    logger.log(`Response sent back to ${uuid}`);
  } catch (e) {
    logger.log(`Cache miss on ${uuid}, sending it to the worker... ${e}`);
    validateRequest(workRequest);
    const { timeout } = workRequest;
    if (Date.parse(timeout) <= Date.now()) {
      throw new Error(`Work request will not be handled as timeout of ${timeout} is in the past...`);
    }
    const workSubmitService = new WorkSubmitService(workRequest);
    await workSubmitService.submitWork();
  }
};


module.exports = handleWorkRequest;
