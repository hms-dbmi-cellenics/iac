/* eslint-env jest */
const express = require('express');
const request = require('supertest');
const expressLoader = require('../../../src/loaders/express');

jest.mock('../../../src/config');

jest.mock('../../../src/api/route-services/experiment');

describe('tests for experiment route', () => {
  // eslint-disable-next-line arrow-parens
  it('Find experiment by id works', async done => {
    const { app } = await expressLoader(express());

    request(app)
      .get('/v1/experiments/someId')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        expect(res.body.experimentId).toBe('someId');
        expect(res.body.experimentName).toBe('my mocky name');
        return done();
      });
  });

  // eslint-disable-next-line arrow-parens
  it('Find cell sets by experiment id works', async done => {
    const { app } = await expressLoader(express());
    request(app)
      .get('/v1/experiments/someId/cellSets')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // there is no point testing for the values of the response body
        // - if something is wrong, the schema validator will catch it
        return done();
      });
  });

  // eslint-disable-next-line arrow-parens
  it('Can successfully generate mock data', async done => {
    const { app } = await expressLoader(express());
    request(app)
      .post('/v1/experiments/generate')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // there is no point testing for the values of the response body
        // - if something is wrong, the schema validator will catch it
        return done();
      });
  });

  afterEach(() => {
    /**
     * Most important since b'coz of caching, the mocked implementations sometimes does not reset
     */
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
