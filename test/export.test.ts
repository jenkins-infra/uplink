import url from 'url';
import request from 'request-promise';

import app from '../src/app';
import {
  createTestUser,
  mintToken,
  createTestGrant,
  cleanupTestUser,
  cleanupTestGrant,
} from './helpers/auth';

const port = (app.get('port') || 3030) + 50;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname,
});

const EXPORT_BODY = { type: 'secret-trial', startDate: '2020-01-01', endDate: '2030-01-01' };

describe('Export authorization', () => {
  let server;

  beforeEach(async () => {
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  it('rejects unauthenticated POST /export with 401', async () => {
    try {
      await request.post(getUrl('/export'), {
        json: true,
        resolveWithFullResponse: true,
        body: EXPORT_BODY,
      });
      fail('Expected a 401 response');
    } catch (err) {
      expect(err.statusCode).toEqual(401);
    }
  });

  describe('authenticated but no grants', () => {
    const GITHUB_ID = 100002;
    const USERNAME = 'no-grants-test-user';
    let token: string;

    beforeEach(async () => {
      const user = await createTestUser(app, { githubId: GITHUB_ID, username: USERNAME });
      token = await mintToken(app, user.id);
    });

    afterEach(async () => {
      await cleanupTestUser(app, GITHUB_ID);
    });

    it('rejects POST /export with 403 when user has no grants', async () => {
      try {
        await request.post(getUrl('/export'), {
          json: true,
          resolveWithFullResponse: true,
          headers: { Authorization: `Bearer ${token}` },
          body: EXPORT_BODY,
        });
        fail('Expected a 403 response');
      } catch (err) {
        expect(err.statusCode).toEqual(403);
      }
    });
  });

  describe('authenticated with narrow grant, wrong type requested', () => {
    const GITHUB_ID = 100003;
    const USERNAME = 'narrow-grant-test-user';
    let token: string;

    beforeEach(async () => {
      const user = await createTestUser(app, { githubId: GITHUB_ID, username: USERNAME });
      await createTestGrant(app, USERNAME, 'jest-example');
      token = await mintToken(app, user.id);
    });

    afterEach(async () => {
      await cleanupTestGrant(app, USERNAME);
      await cleanupTestUser(app, GITHUB_ID);
    });

    it('rejects POST /export with 403 when type is outside the user\'s grants', async () => {
      try {
        await request.post(getUrl('/export'), {
          json: true,
          resolveWithFullResponse: true,
          headers: { Authorization: `Bearer ${token}` },
          body: EXPORT_BODY, // type: 'secret-trial', not in grants
        });
        fail('Expected a 403 response');
      } catch (err) {
        expect(err.statusCode).toEqual(403);
      }
    });
  });
});
