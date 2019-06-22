import url from 'url';
import request from 'request-promise';

import app from '../src/app';
import types from '../src/services/types';

// Offsetting a bit to ensure that we can watch and run at the same time
const port = (app.get('port') || 3030) + 10;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname
});

describe('Acceptance tests for /types', () => {
  beforeEach((done) => {
    this.server = app.listen(port);
    this.server.once('listening', () => done());
  });
  afterEach(done => this.server.close(done));

  describe('with unauthenticated requests', () => {
    it('responds to GET /types', () => {
      return request(getUrl('/types'), {
        json: true,
        resolveWithFullResponse: true,
      }).then(response =>
        expect(response.statusCode).toEqual(401)
      ).catch(err =>
        expect(err.statusCode).toEqual(401)
      );
    });
  });

  describe('with authenticated requests', () => {
    it('responds to GET /types with an Array of types', () => {
      return request(getUrl('/types'), {
        json: true,
        resolveWithFullResponse: true,
        qs: {
          testing_access_token: true,
        },
      }).then((response) => {
        expect(response.statusCode).toEqual(200);
        expect(response.body).toBeInstanceOf(Array);
      });
    });
  });
});
