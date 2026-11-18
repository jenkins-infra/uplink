/**
 * Regression tests for SECURITY-4538:
 * Uplink must not allow anonymous read/write access to the grants table.
 *
 * The attack: POST /authentication with no credentials issued a JWT with
 * sub:"anonymous", and that token could read and write /grants.
 */
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

// Offset to avoid port collision with app.test.ts (+20) and events.test.ts (+10)
const port = (app.get('port') || 3030) + 30;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname,
});

describe('SECURITY-4538 regression: grants access control', () => {
  let server;

  beforeEach(done => {
    server = app.listen(port);
    server.once('listening', () => done());
  });

  afterEach(done => { server.close(done); });

  describe('POST /authentication', () => {
    it('rejects credential-free requests (empty body)', async () => {
      try {
        await request.post(getUrl('/authentication'), {
          json: true,
          resolveWithFullResponse: true,
          body: {},
        });
        fail('Expected a 401 response');
      } catch (err) {
        expect(err.statusCode).toEqual(401);
      }
    });

    it('rejects requests with a non-empty body but no recognized strategy', async () => {
      try {
        await request.post(getUrl('/authentication'), {
          json: true,
          resolveWithFullResponse: true,
          body: { x: 1 },
        });
        fail('Expected a 401 response');
      } catch (err) {
        expect(err.statusCode).toEqual(401);
      }
    });
  });

  describe('GET /grants', () => {
    it('rejects unauthenticated requests with 401', async () => {
      try {
        await request.get(getUrl('/grants'), {
          json: true,
          resolveWithFullResponse: true,
        });
        fail('Expected a 401 response');
      } catch (err) {
        expect(err.statusCode).toEqual(401);
      }
    });
  });

  describe('POST /grants', () => {
    it('rejects unauthenticated requests with 401', async () => {
      try {
        await request.post(getUrl('/grants'), {
          json: true,
          resolveWithFullResponse: true,
          body: {},
        });
        fail('Expected a 401 response');
      } catch (err) {
        expect(err.statusCode).toEqual(401);
      }
    });
  });

  describe('DELETE /grants/:id', () => {
    it('rejects unauthenticated requests with 401', async () => {
      try {
        await request.delete(getUrl('/grants/1'), {
          json: true,
          resolveWithFullResponse: true,
        });
        fail('Expected a 401 response');
      } catch (err) {
        expect(err.statusCode).toEqual(401);
      }
    });
  });

  describe('privilege escalation: narrow-grant user cannot write grants', () => {
    const LIMITED_GITHUB_ID = 100001;
    const LIMITED_USERNAME = 'limited-test-user';
    let limitedToken: string;

    beforeEach(async () => {
      const user = await createTestUser(app, { githubId: LIMITED_GITHUB_ID, username: LIMITED_USERNAME });
      await createTestGrant(app, LIMITED_USERNAME, 'jest-example');
      limitedToken = await mintToken(app, user.id);
    });

    afterEach(async () => {
      await cleanupTestGrant(app, LIMITED_USERNAME);
      await cleanupTestUser(app, LIMITED_GITHUB_ID);
    });

    it('rejects POST /grants from a user with only a narrow grant (no self-promotion)', async () => {
      try {
        await request.post(getUrl('/grants'), {
          json: true,
          resolveWithFullResponse: true,
          headers: { Authorization: `Bearer ${limitedToken}` },
          body: { name: LIMITED_USERNAME, type: '*' },
        });
        fail('Expected a 403 response');
      } catch (err) {
        expect(err.statusCode).toEqual(403);
      }
    });

    it('rejects DELETE /grants/:id from a user with only a narrow grant', async () => {
      try {
        await request.delete(getUrl('/grants/1'), {
          json: true,
          resolveWithFullResponse: true,
          headers: { Authorization: `Bearer ${limitedToken}` },
        });
        fail('Expected a 403 response');
      } catch (err) {
        expect(err.statusCode).toEqual(403);
      }
    });
  });
});
