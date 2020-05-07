/* eslint-env jest */
const express = require('express');
const request = require('supertest');
const expressLoader = require('../../loaders/express');

jest.mock('../route-services/experiment');

describe('tests for experiment route', () => {
  // eslint-disable-next-line arrow-parens
  it('Find experiment by id works', async done => {
    const { app } = await expressLoader(express());

    request(app)
      .get('/v1/experiments/someId')
      // .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        const respKeys = Object.keys(res.body).sort();
        expect(respKeys).toEqual(['experimentId', 'experimentName']);
        expect(res.body.experimentId).toBe('someId');
        expect(res.body.experimentName).toBe('my mocky name');
        return done();
      });
  });

  afterEach(() => {
    /**
     * Most important since b'coz of caching, the mocked implementations sometimes does not resets
     */
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
