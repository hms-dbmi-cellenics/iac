/* eslint-env jest */
const express = require('express');
const request = require('supertest');
const expressLoader = require('../../../src/loaders/express');

describe('tests for the healthcheck route', () => {
  // eslint-disable-next-line arrow-parens
  it('Check health', async done => {
    const { app } = await expressLoader(express());

    request(app)
      .get('/v1/health')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        expect(res.body.status).toBe('up');
        expect(res.body.env).toBe('test');
        expect(res.body.clusterEnv).toBe('staging');
        return done();
      });
  });
});
