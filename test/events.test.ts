import url from 'url';
import request from 'request-promise';
import { HooksObject } from '@feathersjs/feathers';

import app from '../src/app';
import { EventsHooks } from '../src/services/events'

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
    beforeEach((done) => {
      this.server = app.listen(port);
      this.server.once('listening', () => done());
    });
    afterEach(done => this.server.close(done));

    it('responds to GET /events', () => {
      return request(getUrl('/events'), {
        json: true,
        resolveWithFullResponse: true,
      }).then(response =>
        expect(response.statusCode).toEqual(401)
      ).catch(err =>
        expect(err.statusCode).toEqual(401)
      );
    });

    describe('POST to /events', () => {
      it('should create a valid event', () => {
        return request.post(getUrl('/events'), {
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
          expect(response.statusCode).toEqual(201)

          // ensure that a type has been created in the types table
          return request.get(getUrl('/types'), {
            json: true,
            resolveWithFullResponse: true,
            qs: { testing_access_token: true },
          }).then((response) => {
            expect(response.statusCode).toEqual(200);
            expect(response.body.length).toEqual(1);
          });
        });
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

    describe('transformCorrelator', () => {
      const context = {
        data: {
          correlator: null,
          type: 'jest',
          payload: {},
        },
      };

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
