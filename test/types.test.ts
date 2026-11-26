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
  beforeEach(async () => {
    server = await app.listen(port);
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

describe('Write methods on /types', () => {
  const ADMIN_GITHUB_ID = 100201;
  const ADMIN_USERNAME = 'types-admin';
  const LIMITED_GITHUB_ID = 100202;
  const LIMITED_USERNAME = 'types-limited';
  const SENTINEL_TYPE = 'types-write-sentinel';

  let server;
  let sentinel;
  let adminToken : string;
  let limitedToken : string;

  const expectStatus = async (promise, status : number) => {
    try {
      await promise;
      fail(`Expected a ${status} response`);
    } catch (err) {
      expect(err.statusCode).toEqual(status);
    }
  };

  const removeSentinel = () =>
    app.service('types').remove(null, { query: { type: SENTINEL_TYPE } });

  beforeAll(async () => {
    const admin = await createTestUser(app, { githubId: ADMIN_GITHUB_ID, username: ADMIN_USERNAME });
    await createTestGrant(app, ADMIN_USERNAME, '*');
    adminToken = await mintToken(app, admin.id);

    const limited = await createTestUser(app, { githubId: LIMITED_GITHUB_ID, username: LIMITED_USERNAME });
    await createTestGrant(app, LIMITED_USERNAME, SENTINEL_TYPE);
    limitedToken = await mintToken(app, limited.id);
  });

  afterAll(async () => {
    await removeSentinel();
    await cleanupTestGrant(app, ADMIN_USERNAME);
    await cleanupTestGrant(app, LIMITED_USERNAME);
    await cleanupTestUser(app, ADMIN_GITHUB_ID);
    await cleanupTestUser(app, LIMITED_GITHUB_ID);
  });

  beforeEach(async () => {
    await removeSentinel();
    sentinel = await app.service('types').create({ type: SENTINEL_TYPE });
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  const callers = [
    { name: 'unauthenticated callers', headers: () => ({}) },
    { name: 'users with a single grant', headers: () => ({ Authorization: `Bearer ${limitedToken}` }) },
    { name: 'admins', headers: () => ({ Authorization: `Bearer ${adminToken}` }) },
  ];

  const writes = [
    { name: 'POST /types', send: headers => request.post(getUrl('/types'), {
      json: true, headers, body: { type: 'injected' },
    }) },
    { name: 'PUT /types/:id', send: headers => request.put(getUrl(`/types/${sentinel.id}`), {
      json: true, headers, body: { type: 'rewritten' },
    }) },
    { name: 'PATCH /types/:id', send: headers => request.patch(getUrl(`/types/${sentinel.id}`), {
      json: true, headers, body: { type: 'rewritten' },
    }) },
    { name: 'PATCH /types', send: headers => request.patch(getUrl('/types'), {
      json: true, headers, body: { type: 'rewritten' },
    }) },
    { name: 'DELETE /types/:id', send: headers => request.delete(getUrl(`/types/${sentinel.id}`), {
      json: true, headers,
    }) },
    { name: 'DELETE /types', send: headers => request.delete(getUrl('/types'), {
      json: true, headers,
    }) },
    { name: 'POST /types/:id with _method=DELETE', send: headers => request.post(getUrl(`/types/${sentinel.id}`), {
      json: true, headers, body: { _method: 'DELETE' },
    }) },
  ];

  for (const caller of callers) {
    describe(`from ${caller.name}`, () => {
      for (const write of writes) {
        it(`rejects ${write.name} and leaves the type untouched`, async () => {
          await expectStatus(write.send(caller.headers()), 405);

          const stored = await app.service('types').get(sentinel.id);
          expect(stored.type).toEqual(SENTINEL_TYPE);
        });
      }
    });
  }

  it('still allows internal update, patch and remove', async () => {
    const types = app.service('types');
    await types.update(sentinel.id, { type: SENTINEL_TYPE });
    await types.patch(sentinel.id, { type: SENTINEL_TYPE });
    await types.remove(sentinel.id);

    const remaining = await types.find({ query: { type: SENTINEL_TYPE } });
    expect(remaining).toHaveLength(0);
  });
});
