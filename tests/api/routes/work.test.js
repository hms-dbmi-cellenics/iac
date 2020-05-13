
/* eslint-env jest */
const express = require('express');
const request = require('supertest');
const https = require('https');
const _ = require('lodash');

const expressLoader = require('../../../src/loaders/express');

const workResponse = require('../../../src/api/route-services/work-response');

jest.mock('sns-validator');

const basicMsg = JSON.stringify({
  MessageId: 'da8827d4-ffc2-5efb-82c1-70f929b2081d',
  ResponseMetadata: {
    RequestId: '826314a1-e99f-5fe7-b845-438c3fef9901',
    HTTPStatusCode: 200,
    HTTPHeaders: {
      'x-amzn-requestid': '826314a1-e99f-5fe7-b845-438c3fef9901',
      'content-type': 'text/xml',
      'content-length': '294',
      date: 'Thu, 07 May 2020 09:26:08 GMT',
    },
    RetryAttempts: 0,
  },
});

describe('tests for experiment route', () => {
  // eslint-disable-next-line arrow-parens
  it('Validating the response throws an error', async done => {
    const { app } = await expressLoader(express());
    const error = jest.spyOn(global.console, 'error');
    const invalidMsg = _.cloneDeep(basicMsg);
    https.get = jest.fn();

    request(app)
      .post('/v1/workResults')
      .send(invalidMsg)
      .set('Content-type', 'text/plain')
      .expect(200)
      .end(() => {
        expect(error).toHaveBeenCalledTimes(1);
        expect(https.get).toHaveBeenCalledTimes(0);
        return done();
      });
  });

  // eslint-disable-next-line arrow-parens
  it('Can handle message subscribtion', async done => {
    const { app } = await expressLoader(express());
    const error = jest.spyOn(global.console, 'error');
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'SubscriptionConfirmation';
    validMsg = JSON.stringify(validMsg);
    https.get = jest.fn();

    request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200)
      .end(() => {
        expect(error).toHaveBeenCalledTimes(0);
        expect(https.get).toHaveBeenCalledTimes(1);
        return done();
      });
  });

  // // eslint-disable-next-line arrow-parens
  it('Can handle message unsubscribtion', async (done) => {
    const { app } = await expressLoader(express());
    const error = jest.spyOn(global.console, 'error');
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'UnsubscribeConfirmation';
    validMsg = JSON.stringify(validMsg);
    https.get = jest.fn();

    request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200)
      .end(() => {
        expect(error).toHaveBeenCalledTimes(0);
        expect(https.get).toHaveBeenCalledTimes(1);
        return done();
      });
  });

  // // eslint-disable-next-line arrow-parens
  it('Can handle notifications', async (done) => {
    const { app } = await expressLoader(express());
    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'Notification';
    validMsg = JSON.stringify(validMsg);

    const error = jest.spyOn(global.console, 'error');
    const mockHandleResponse = jest.fn();
    jest.mock('../../../src/api/route-services/work-response',
      () => jest.fn().mockImplementation(() => ({ handleResponse: mockHandleResponse })));

    request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200)
      .end(() => {
        expect(error).toHaveBeenCalledTimes(0);
        expect(mockHandleResponse).toHaveBeenCalledTimes(1);
        return done();
      });
  });

  // // eslint-disable-next-line arrow-parens
  it('Returns an error when message in sns is malformed', async (done) => {
    const { app } = await expressLoader(express());

    let validMsg = _.cloneDeep(JSON.parse(basicMsg));
    validMsg.Type = 'NotificationMalformed';
    validMsg = JSON.stringify(validMsg);

    const error = jest.spyOn(global.console, 'error');
    const mockHandleResponse = jest.fn();
    jest.mock('../../../src/api/route-services/work-response',
      () => jest.fn().mockImplementation(() => ({ handleResponse: mockHandleResponse })));

    request(app)
      .post('/v1/workResults')
      .send(validMsg)
      .set('Content-type', 'text/plain')
      .expect(200)
      .end(() => {
        expect(error).toHaveBeenCalledTimes(1);
        expect(mockHandleResponse).toHaveBeenCalledTimes(0);
        return done();
      });
  });

  // // eslint - disable - next - line arrow - parens
  it('Get malformatted work results returns an error', async (done) => {
    const { app } = await expressLoader(express());

    const brokenMsg = JSON.stringify();

    request(app)
      .post('/v1/workResults')
      .send(brokenMsg)
      .set('Content-type', 'text/plain')
      .expect(500)
      .end(() => done());
  });

  afterEach(() => {
    /**
     * Most important since b'coz of caching, the mocked implementations sometimes does not reset
     */
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
