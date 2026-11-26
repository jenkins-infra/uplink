import url from 'url';
import request from 'request-promise';
import { HookContext } from '@feathersjs/feathers';


import app from '../src/app';
import { EventsHooks } from '../src/services/events'
import {
  createTestUser,
  mintToken,
  createTestGrant,
  cleanupTestUser,
  cleanupTestGrant,
} from './helpers/auth';

// Offsetting a bit to ensure that we can watch and run at the same time
const port = (app.get('port') || 3030) + 10;
const getUrl = pathname => url.format({
  hostname: app.get('host') || 'localhost',
  protocol: 'http',
  port,
  pathname
});

describe('Events service tests', () => {
  describe('Acceptance tests for /events', () => {
    let server
    beforeEach(async () => {
      server = await app.listen(port);
    });
    afterEach(done => {
      server.close(done)
    });

    it('responds to GET /events', async () => {
      try {
        const response = await request(getUrl('/events'), {
          json: true,
          resolveWithFullResponse: true,
        })
        expect(response.statusCode).toEqual(401)

      } catch (err) {
          expect(err.statusCode).toEqual(401)
        }
    });

    describe('POST to /events', () => {
      beforeEach(async () => {
        const removalArgs = { query: { $limit: 1000 } };
        await app.service('events')
          .remove(null, removalArgs);
        await app.service('types').remove(null, removalArgs);
      });

      it('should create a valid event', (done) => {
        request.post(getUrl('/events'), {
          json: true,
          resolveWithFullResponse: true,
          body: {
            type: 'jest-example',
            payload: {
              generatedAt: Date.now(),
            },
            correlator: '0xdeadbeef',
          },
        }).then((response) => {
          expect(response.statusCode).toEqual(204);

          // ensure that a type has been created in the types table
          request.get(getUrl('/types'), {
            json: true,
            resolveWithFullResponse: true,
            qs: { testing_access_token: true },
          }).then((response) => {
            expect(response.statusCode).toEqual(200);
            expect(response.body.length).toEqual(1);
            done();
          });
        });
      });

      it('should reject attempts to override protected fields', async () => {
        const maliciousId = 999999;
        const maliciousDate = '2020-01-01T00:00:00.000Z';

        const response = await request.post(getUrl('/events'), {
          json: true,
          resolveWithFullResponse: true,
          body: {
            type: 'jest-malicious',
            payload: { test: 'data' },
            correlator: '0xbadactor',
            id: maliciousId,
            createdAt: maliciousDate,
            updatedAt: maliciousDate,
          },
        });
        expect(response.statusCode).toEqual(204);

        // Fetch the stored event to verify protected fields were not overridden
        const events = await app.service('events').find({
          query: { type: 'jest-malicious', testing_access_token: true },
        });
        expect(events.length).toEqual(1);
        const stored = events[0];

        expect(stored.id).not.toEqual(maliciousId);
        expect(stored.createdAt.toISOString()).not.toEqual(maliciousDate);
        expect(stored.updatedAt.toISOString()).not.toEqual(maliciousDate);
        expect(stored.type).toEqual('jest-malicious');
        expect(stored.correlator).toEqual('0xbadactor');
        expect(stored.payload).toEqual({ test: 'data' });
      });
    });
  });

  describe('EventsHooks unit tests', () => {
    it('should implement a getHooks()', () => {
      expect(EventsHooks.getHooks()).toHaveProperty('before');
      expect(EventsHooks.getHooks()).toHaveProperty('after');
      expect(EventsHooks.getHooks()).toHaveProperty('error');
    })

    describe('denormalizeType()', () => {
    });

    describe('filterFields', () => {
      it('should only allow whitelisted fields', () => {
        const context: any = {
          data: {
            type: 'jest-test',
            correlator: 'test-correlator',
            payload: { foo: 'bar' },
            id: 999999,
            createdAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
            maliciousField: 'should-be-removed',
          },
          app: null,
          method: null,
          params: null,
          path: null,
          service: null,
          type: null,
        };
        return EventsHooks.filterFields(context).then((result) => {
          const ctx = result as HookContext<any>;
          expect(ctx.data).toHaveProperty('type', 'jest-test');
          expect(ctx.data).toHaveProperty('correlator', 'test-correlator');
          expect(ctx.data).toHaveProperty('payload', { foo: 'bar' });
          expect(ctx.data).not.toHaveProperty('id');
          expect(ctx.data).not.toHaveProperty('createdAt');
          expect(ctx.data).not.toHaveProperty('updatedAt');
          expect(ctx.data).not.toHaveProperty('maliciousField');
        });
      });

      it('should handle missing optional fields', () => {
        const context: any = {
          data: {
            type: 'jest-test',
            payload: { foo: 'bar' },
          },
          app: null,
          method: null,
          params: null,
          path: null,
          service: null,
          type: null,
        };

        return EventsHooks.filterFields(context).then((result) => {
          const ctx = result as HookContext<any>;
          expect(ctx.data).toHaveProperty('type', 'jest-test');
          expect(ctx.data).toHaveProperty('payload', { foo: 'bar' });
          expect(ctx.data).not.toHaveProperty('correlator');
        });
      });
    });

    describe('transformCorrelator', () => {
      const context: any = {
        data: {
          correlator: null,
          type: 'jest',
          payload: {},
        },
        app: null,
        method: null,
        params: null,
        path: null,
        service: null,
        type: null,
      };

      it('should match the transform that the Jenkins core code uses', () => {
        const correlator = "00000000-0000-0000-0000-000000000000";
        const hashedCorrelator = '90ecf3ce1cd5ba1e5ad3cde7ad08a941e884f2e4d9bd463361715abab8efedc5';
        const eventType = 'test-data';
        context.data.correlator = correlator;
        context.data.type = eventType;


        return expect(EventsHooks.transformCorrelator(context)).resolves.toHaveProperty('data.correlator', hashedCorrelator);
      });

      it('should transform correlators that look like UUIDs', () => {
        const correlator = '86e3f00d-b12a-4391-bbf2-6f01c1606e17';
        context.data.correlator = correlator;

        return expect(EventsHooks.transformCorrelator(context)).resolves.not.toHaveProperty('data.correlator', correlator);
      });

      it('should NOT transform correlators that look like signatures', () => {
        const correlator = 'e9df4c4e4e64b8168a71c3c67668dcffabbe8fca11d4ac4a7d5482562cd1679c';
        context.data.correlator = correlator;

        return expect(EventsHooks.transformCorrelator(context)).resolves.toHaveProperty('data.correlator', correlator);
      });
    });
  });
});

describe('Write methods on /events', () => {
  const ADMIN_GITHUB_ID = 100301;
  const ADMIN_USERNAME = 'events-admin';
  const LIMITED_GITHUB_ID = 100302;
  const LIMITED_USERNAME = 'events-limited';
  const SENTINEL_TYPE = 'events-write-sentinel';
  const SENTINEL_CORRELATOR = 'events-write-sentinel-correlator';
  const SENTINEL_PAYLOAD = { original: true };

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

  // `find`/`get` on events require authorization even for internal calls
  const testAccess = () => ({ query: { testing_access_token: true } });

  const removeSentinel = async () => {
    await app.service('events').remove(null, { query: { type: SENTINEL_TYPE } });
    await app.service('types').remove(null, { query: { type: SENTINEL_TYPE } });
  };

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
    sentinel = await app.service('events').create({
      type: SENTINEL_TYPE,
      correlator: SENTINEL_CORRELATOR,
      payload: SENTINEL_PAYLOAD,
    });
    server = await app.listen(port);
  });

  afterEach(done => { server.close(done); });

  const callers = [
    { name: 'unauthenticated callers', headers: () => ({}) },
    { name: 'users with a matching grant', headers: () => ({ Authorization: `Bearer ${limitedToken}` }) },
    { name: 'admins', headers: () => ({ Authorization: `Bearer ${adminToken}` }) },
  ];

  const rewritten = { type: SENTINEL_TYPE, correlator: 'rewritten', payload: { rewritten: true } };
  const writes = [
    { name: 'PUT /events/:id', send: headers => request.put(getUrl(`/events/${sentinel.id}`), {
      json: true, headers, body: rewritten,
    }) },
    { name: 'PATCH /events/:id', send: headers => request.patch(getUrl(`/events/${sentinel.id}`), {
      json: true, headers, body: { payload: { rewritten: true } },
    }) },
    { name: 'PATCH /events', send: headers => request.patch(getUrl('/events'), {
      json: true, headers, body: { payload: { rewritten: true } },
    }) },
    { name: 'DELETE /events/:id', send: headers => request.delete(getUrl(`/events/${sentinel.id}`), {
      json: true, headers,
    }) },
    { name: 'DELETE /events', send: headers => request.delete(getUrl('/events'), {
      json: true, headers,
    }) },
    { name: 'POST /events/:id with _method=DELETE', send: headers => request.post(getUrl(`/events/${sentinel.id}`), {
      json: true, headers, body: { _method: 'DELETE' },
    }) },
  ];

  for (const caller of callers) {
    describe(`from ${caller.name}`, () => {
      for (const write of writes) {
        it(`rejects ${write.name} and leaves the event untouched`, async () => {
          await expectStatus(write.send(caller.headers()), 405);

          const stored = await app.service('events').get(sentinel.id, testAccess());
          expect(stored.correlator).toEqual(SENTINEL_CORRELATOR);
          expect(stored.payload).toEqual(SENTINEL_PAYLOAD);
        });
      }
    });
  }

  it('still allows unauthenticated POST /events for ingestion', async () => {
    const response = await request.post(getUrl('/events'), {
      json: true,
      resolveWithFullResponse: true,
      body: { type: SENTINEL_TYPE, correlator: 'ingested', payload: { ok: true } },
    });
    expect(response.statusCode).toEqual(204);
  });

  it('still allows internal update, patch and remove', async () => {
    const events = app.service('events');
    await events.update(sentinel.id, { ...rewritten });
    await events.patch(sentinel.id, { payload: SENTINEL_PAYLOAD });
    expect((await events.get(sentinel.id, testAccess())).correlator).toEqual('rewritten');

    await events.remove(sentinel.id);
    await expect(events.get(sentinel.id, testAccess())).rejects.toHaveProperty('code', 404);
  });
});
