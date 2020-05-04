const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Validator = require('swagger-model-validator');

class WorkResponseService {
  constructor(io, workResponse) {
    const specPath = path.resolve(__dirname, '..', 'specs', 'api.yaml');
    const specObj = yaml.safeLoad(fs.readFileSync(specPath), 'utf8');
    const validator = new Validator();

    const res = validator.validate(workResponse, specObj.components.schemas.WorkResponse, specObj.components.schemas);

    if (!res.valid) {
      throw new Error(res.errors);
    }

    this.workResponse = workResponse;
    this.io = io;
  }

  sendResponse() {
    /*
    console.log(this.workResponse.socketId);
    this.io.to(this.workResponse.socketId).emit('news', [
      { title: 'The cure of the Sadness is to play Videogames', date: '04.10.2016' },
      { title: 'Batman saves Racoon City, the Joker is infected once again', date: '05.10.2016' },
      { title: "Deadpool doesn't want to do a third part of the franchise", date: '05.10.2016' },
      { title: 'Quicksilver demand Warner Bros. due to plagiarism with Speedy Gonzales', date: '04.10.2016' },
    ]);
    */
  }
}

module.exports = WorkResponseService;
