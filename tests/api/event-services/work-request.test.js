const WorkRequestService = require('../../../src/api/event-services/work-request');

describe('tests for the work-request service', () => {
  it('Throws when an old timeout is encountered.', async (done) => {
    const workRequest = {
      uuid: '12345',
      socketId: '6789',
      experimentId: 'my-experiment',
      timeout: '2001-01-01T00:00:00Z',
      body: { name: 'GetEmbedding', type: 'pca' },
    };

    try {
      // eslint-disable-next-line no-unused-vars
      const w = new WorkRequestService(workRequest);
    } catch (e) {
      expect(e.message).toMatch(
        /^Work request will not be handled as timeout/,
      );
      return done();
    }
  });
});
