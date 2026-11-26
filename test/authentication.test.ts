/**
 * Tests for the browser-facing authentication: the JWT cookie accepted by the
 * UI routes, and the GitHub OAuth login redirect.
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

const port = (app.get('port') || 3030) + 70;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname,
});

describe('Browser authentication', () => {
  const GITHUB_ID = 100201;
  const USERNAME = 'authentication-user';
  let server;
  let token : string;
  let event;

  beforeAll(async () => {
    const user = await createTestUser(app, { githubId: GITHUB_ID, username: USERNAME });
    await createTestGrant(app, USERNAME, 'jest-example');
    token = await mintToken(app, user.id);
    // The dashboard view cannot render an empty list of events
    event = await app.service('events').create({ type: 'jest-example', correlator: 'authentication-test', payload: {} });
  });

  afterAll(async () => {
    await app.service('events').remove(event.id);
    await cleanupTestGrant(app, USERNAME);
    await cleanupTestUser(app, GITHUB_ID);
  });

  beforeEach(async () => {
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  const cookieName = () => app.get('authentication').cookie.name;

  it('accepts the JWT cookie on /dashboard', async () => {
    const response = await request.get(getUrl('/dashboard'), {
      headers: { Cookie: `${cookieName()}=${token}` },
      resolveWithFullResponse: true,
    });
    expect(response.statusCode).toEqual(200);
  });

  it('rejects a forged JWT cookie on /dashboard', async () => {
    try {
      await request.get(getUrl('/dashboard'), {
        headers: { Cookie: `${cookieName()}=${token}x` },
      });
      fail('Expected a 401 response');
    } catch (err) {
      expect(err.statusCode).toEqual(401);
    }
  });

  it('rejects /dashboard without any credentials', async () => {
    try {
      await request.get(getUrl('/dashboard'));
      fail('Expected a 401 response');
    } catch (err) {
      expect(err.statusCode).toEqual(401);
    }
  });

  it('redirects /auth/github to GitHub with an absolute callback URL', async () => {
    try {
      await request.get(getUrl('/auth/github'), { followRedirect: false });
      fail('Expected a redirect');
    } catch (err) {
      expect(err.statusCode).toEqual(303);
      const location = new URL(err.response.headers.location);
      expect(location.origin).toEqual('https://github.com');
      expect(location.searchParams.get('redirect_uri'))
        .toMatch(/^https?:\/\/[^/]+\/auth\/github\/callback$/);
    }
  });

  it('does not accept forged OAuth profiles on /auth/github/callback', async () => {
    try {
      await request.get(getUrl('/auth/github/callback'), {
        followRedirect: false,
        qs: { code: 'forged', state: 'forged' },
      });
      fail('Expected a failure');
    } catch (err) {
      expect(err.response.headers['set-cookie'] || []).not.toEqual(
        expect.arrayContaining([expect.stringContaining(cookieName())]));
    }
  });
});
