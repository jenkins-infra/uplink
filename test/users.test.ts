import url from 'url';
import request from 'request-promise';

import app from '../src/app';

const port = (app.get('port') || 3030) + 40;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname,
});

describe('Users service: external access blocked', () => {
  let server;

  beforeEach(async () => {
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  it('rejects unauthenticated GET /users via REST with 401', async () => {
    try {
      await request.get(getUrl('/users'), {
        json: true,
        resolveWithFullResponse: true,
      });
      fail('Expected a 401 response');
    } catch (err) {
      expect(err.statusCode).toEqual(401);
    }
  });
});
