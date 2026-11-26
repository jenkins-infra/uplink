/**
 * Acceptance tests for access control hardening: query sanitization, methods
 * that must not be reachable through REST, token issuance, cross-origin
 * request rejection, and security headers.
 */
import url from 'url';
import request from 'request-promise';

import app from '../src/app';
import {
  createTestUser,
  mintToken,
  mintAnonymousToken,
  createTestGrant,
  cleanupTestUser,
  cleanupTestGrant,
} from './helpers/auth';

// Offset to avoid port collision with the other acceptance tests
const port = (app.get('port') || 3030) + 60;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname,
});

const expectStatus = async (promise, status : number) => {
  try {
    await promise;
    fail(`Expected a ${status} response`);
  } catch (err) {
    expect(err.statusCode).toEqual(status);
  }
};

describe('Access control hardening', () => {
  const ADMIN_GITHUB_ID = 100101;
  const ADMIN_USERNAME = 'hardening-admin';
  const LIMITED_GITHUB_ID = 100102;
  const LIMITED_USERNAME = 'hardening-limited';
  let server;
  let adminToken : string;
  let limitedToken : string;
  let anonymousToken : string;

  beforeAll(async () => {
    const admin = await createTestUser(app, { githubId: ADMIN_GITHUB_ID, username: ADMIN_USERNAME });
    await createTestGrant(app, ADMIN_USERNAME, '*');
    adminToken = await mintToken(app, admin.id);

    const limited = await createTestUser(app, { githubId: LIMITED_GITHUB_ID, username: LIMITED_USERNAME });
    await createTestGrant(app, LIMITED_USERNAME, 'jest-example');
    limitedToken = await mintToken(app, limited.id);

    anonymousToken = await mintAnonymousToken(app);
  });

  afterAll(async () => {
    await cleanupTestGrant(app, ADMIN_USERNAME);
    await cleanupTestGrant(app, LIMITED_USERNAME);
    await cleanupTestUser(app, ADMIN_GITHUB_ID);
    await cleanupTestUser(app, LIMITED_GITHUB_ID);
  });

  beforeEach(async () => {
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  const auth = (token : string) => ({ Authorization: `Bearer ${token}` });

  describe('POST /authentication', () => {
    const bodies = [
      { strategy: 'jwt' },
      { payload: { userId: 1 } },
      { strategy: 'jwt', payload: { userId: 1 } },
    ];
    for (const body of bodies) {
      it(`does not issue tokens for ${JSON.stringify(body)}`, () => {
        return expectStatus(request.post(getUrl('/authentication'), { json: true, body }), 401);
      });
    }

    it('does not issue tokens when an Authorization header is present', () => {
      return expectStatus(request.post(getUrl('/authentication'), {
        json: true,
        headers: { Authorization: 'junk' },
        body: { strategy: 'jwt' },
      }), 401);
    });

    it('does not re-issue tokens for a valid token', () => {
      return expectStatus(request.post(getUrl('/authentication'), {
        json: true,
        headers: auth(limitedToken),
        body: { strategy: 'jwt', accessToken: limitedToken },
      }), 401);
    });
  });

  describe('query sanitization', () => {
    it('rejects $select on /events (SQL injection via raw attributes)', () => {
      return expectStatus(request.get(getUrl('/events'), {
        json: true,
        headers: auth(limitedToken),
        qs: { $select: [['(SELECT 1)', 'x']] },
      }), 400);
    });

    it('rejects $select on /types', () => {
      return expectStatus(request.get(getUrl('/types'), {
        json: true,
        headers: auth(limitedToken),
        qs: { $select: [['(SELECT 1)', 'x']] },
      }), 400);
    });

    it('rejects $select on /dashboard', () => {
      return expectStatus(request.get(getUrl('/dashboard'), {
        headers: auth(limitedToken),
        qs: { $select: [['(SELECT 1)', 'x']] },
      }), 400);
    });

    it('rejects JSON path queries on payload', () => {
      return expectStatus(request.get(getUrl('/events'), {
        json: true,
        headers: auth(limitedToken),
        qs: { payload: { a: '1' } },
      }), 400);
    });

    it('still allows simple filters', async () => {
      const events = await request.get(getUrl('/events'), {
        json: true,
        headers: auth(limitedToken),
        qs: { type: 'other-type', $sort: { createdAt: -1 } },
      });
      expect(Array.isArray(events)).toBe(true);
      expect(events.every(e => e.type === 'jest-example')).toBe(true);
    });
  });

  describe('methods not available through REST', () => {
    it('rejects PATCH /events/:id', () => {
      return expectStatus(request.patch(getUrl('/events/1'), {
        json: true, headers: auth(adminToken), body: { payload: {} },
      }), 405);
    });

    it('rejects PUT /events/:id', () => {
      return expectStatus(request.put(getUrl('/events/1'), {
        json: true, headers: auth(adminToken), body: { type: 'x' },
      }), 405);
    });

    it('rejects DELETE /events/:id', () => {
      return expectStatus(request.delete(getUrl('/events/1'), {
        json: true, headers: auth(adminToken),
      }), 405);
    });

    it('rejects DELETE /events', () => {
      return expectStatus(request.delete(getUrl('/events'), {
        json: true, headers: auth(adminToken),
      }), 405);
    });

    it('rejects POST /types', () => {
      return expectStatus(request.post(getUrl('/types'), {
        json: true, headers: auth(limitedToken), body: { type: 'injected' },
      }), 405);
    });
  });

  describe('tokens without a GitHub identity', () => {
    it('get 403 from /events', () => {
      return expectStatus(request.get(getUrl('/events'), { json: true, headers: auth(anonymousToken) }), 403);
    });

    it('get 403 from /dashboard', () => {
      return expectStatus(request.get(getUrl('/dashboard'), { headers: auth(anonymousToken) }), 403);
    });

    it('get 403 from /admin', () => {
      return expectStatus(request.get(getUrl('/admin'), { headers: auth(anonymousToken) }), 403);
    });
  });

  describe('cross-origin requests', () => {
    const grantBody = { name: 'hardening-csrf', type: '*' };

    afterEach(() => cleanupTestGrant(app, grantBody.name));

    it('rejects state-changing requests with Sec-Fetch-Site: cross-site', () => {
      return expectStatus(request.post(getUrl('/grants'), {
        json: true,
        headers: { ...auth(adminToken), 'Sec-Fetch-Site': 'cross-site' },
        body: grantBody,
      }), 403);
    });

    it('rejects state-changing requests with Sec-Fetch-Site: same-site', () => {
      return expectStatus(request.post(getUrl('/grants'), {
        json: true,
        headers: { ...auth(adminToken), 'Sec-Fetch-Site': 'same-site' },
        body: grantBody,
      }), 403);
    });

    it('rejects state-changing requests with a foreign Origin', () => {
      return expectStatus(request.post(getUrl('/grants'), {
        json: true,
        headers: { ...auth(adminToken), Origin: 'https://evil.example' },
        body: grantBody,
      }), 403);
    });

    it('allows same-origin requests', async () => {
      const grant = await request.post(getUrl('/grants'), {
        json: true,
        headers: { ...auth(adminToken), 'Sec-Fetch-Site': 'same-origin' },
        body: grantBody,
      });
      expect(grant.name).toEqual(grantBody.name);
    });

    it('does not send CORS headers', async () => {
      const response = await request.get(getUrl('/'), {
        resolveWithFullResponse: true,
        headers: { Origin: 'https://evil.example' },
      });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('sends a Content-Security-Policy header', async () => {
    const response = await request.get(getUrl('/'), { resolveWithFullResponse: true });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });
});
