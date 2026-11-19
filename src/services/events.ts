/*
 * The /events service is responsible receiving the data POSTed from the
 * Jenkins instances and storing it in the database
 */

import { createHash } from 'crypto';
import { Application, HookContext, HooksObject } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import service from 'feathers-sequelize';

import allowExternal from '../hooks/allow-external';
import authorize from '../hooks/authorize';
import applyGrant from '../hooks/apply-grant';
import sanitizeQuery from '../hooks/sanitize-query';
import db from '../models';
import Event from '../models/event';

/*
 * The columns that may be used for filtering and sorting events. Notably
 * excludes `payload`, as nested queries on JSON columns become JSON path
 * expressions in Sequelize.
 */
const QUERYABLE_COLUMNS = ['id', 'type', 'correlator', 'createdAt', 'updatedAt'];

export class EventsHooks {
  /**
   * This feathers hook function is responsible for denormalizing the `type`
   * passed along in the event payload.
   *
   * If the types service already has stored the `type` a unique constraint
   * error will be thrown and swallowed.
   *
   * @param {HookContext}
   * @return {Promise | HookContext}
   */
  static denormalizeType(context : HookContext) : Promise<void | HookContext<any>> {
    return context.app.service('types')
      .create({
        type: context.data.type,
      })
    .then(() => { return context; })
    .catch((err) => {
      // hitting the UNIQUE constraint is an acceptable error
      if (!err.errors.filter(e => e.type == 'unique violation')) {
        throw err;
      }
    });
  }


  /**
   * This feathers hook function is responsible for creating a type-specific
   * correlator ID for legacy instances which do not properly segregate their
   * correlator IDs between trials
   *
   * See also: https://github.com/jenkins-infra/uplink/issues/15
   *
   * @param {HookContext}
   * @return {Promise | HookContext}
   */
  static transformCorrelator(context : HookContext) : Promise<void | HookContext<any>> {
    if (!context.data.correlator) {
      return Promise.resolve(context);
    }
    if (typeof context.data.correlator !== 'string') {
      throw new BadRequest('correlator must be a string');
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.data.correlator)) {
      const hasher = createHash('SHA256');
      hasher.update(`${context.data.correlator}${context.data.type}`);
      context.data.correlator = hasher.digest('hex');
    }
    return Promise.resolve(context);
  }

  /**
   * This feathers hook function prevents overriding protected fields like id, createdAt
   * and updatedAt by only allowing whitelisted fields to be set during event creation.
   *
   * @param {HookContext}
   * @return {Promise | HookContext}
   */
  static filterFields(context : HookContext) : Promise<void | HookContext<any>> {
    const allowedFields = ['type', 'correlator', 'payload'];
    const filtered = {};

    for (const field of allowedFields) {
      if (context.data.hasOwnProperty(field)) {
        filtered[field] = context.data[field];
      }
    }

    context.data = filtered;
    return Promise.resolve(context);
  }

  /**
   * getHooks() simply returns a HooksObject for passing into Feathers
   *
   * It exists to make this all a bit more simple to test, nothing more
   *
   * @return {HooksObject}
   */
  static getHooks() : HooksObject {
    return {
      before: {
        /*
         * Deny by default: only the methods listed here are reachable through
         * REST. Events are append-only telemetry: nobody needs to modify or
         * delete them through the API. `remove` is still used internally by
         * tests.
         */
        all: [
          allowExternal(['find', 'get', 'create']),
        ],
        find: [
          authorize(),
          sanitizeQuery(QUERYABLE_COLUMNS),
          applyGrant(),
          /*
          * Pagination for feathers-sequelize relies on Model.findAndCountAll()
          * which implements superslow SELECT COUNT(DISTINCT(id)) FROM events
          * queries against the super-big database tables in production.
          *
          * Rather than rely on pagination, we'll simply add our limit and let the
          * front-end go forwards and backwards, but never discover the total
          * number of pages
          */
          (context) => {
            Object.assign(context.params.query, {
              $limit: 25,
            });
          },
        ],
        get: [
          authorize(),
          sanitizeQuery(QUERYABLE_COLUMNS),
          applyGrant(),
        ],
        create: [
          /*
          * The create route is unauthenticated so clients can POST events
          */
          this.filterFields,
          this.transformCorrelator,
        ],
      },
      after: {
        create: [
          this.denormalizeType,
          (context) => { if (context.params.provider) { context.result = null; } },
        ],
      },
      error: {},
    };
  }
}

export default (app : Application) => {
  const Model : any = Event(db.sequelize, db.sequelize.Sequelize);
  app.use('/events', service({
    Model: Model,
  }));
  app.service('events').hooks(EventsHooks.getHooks());
};
