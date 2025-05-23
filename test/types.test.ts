import url from 'url';
import request from 'request-promise';

import app from '../src/app';
import types from '../src/services/types';

// Offsetting a bit to ensure that we can watch and run at the same time
const port = (app.get('port') || 3030) + 50;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname
});

describe('Acceptance tests for /types', () => {
  let server
  beforeEach((done) => {
    server = app.listen(port);
    server.once('listening', () => done());
  });
  afterEach(done => {
    server.close(done)
  });

  describe('with unauthenticated requests', () => {
    it('responds to GET /types', async () => {
      try {
      const response = await request(getUrl('/types'), {
        json: true,
        resolveWithFullResponse: true,
      })
    } catch (err) {
      expect(err.statusCode).toEqual(401)
    }
    });
  });

  describe('with authenticated requests', () => {
    it('responds to GET /types with an Array of types', async () => {
      const response = await request(getUrl('/types'), {
        json: true,
        resolveWithFullResponse: true,
        qs: {
          testing_access_token: true,
        },
      })
      expect(response.statusCode).toEqual(200);
      expect(response.body).toBeInstanceOf(Array);
    });
  });
});
