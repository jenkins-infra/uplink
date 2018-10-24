/*
 * The /events service is responsible receiving the data POSTed from the
 * Jenkins instances and storing it in the database
 */

import { createHash } from 'crypto';
import { Application, HookContext, HooksObject } from '@feathersjs/feathers';
import service from 'feathers-sequelize';
import { Operators, DataTypes } from 'sequelize';

import authorize from '../hooks/authorize';
import applyGrant from '../hooks/apply-grant';
import logger from '../logger';
import db from '../models';
import Event from '../models/event';

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
    if ((context.data.correlator) &&
        (context.data.correlator.match(/(\w+)-(\w+)-(\w+)-(\w+)-(\w+)/))) {
      const hasher = createHash('SHA256');
      hasher.update(`${context.data.correlator}${context.data.type}`);
      context.data.correlator = hasher.digest('hex');
    }
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
        all: [
        ],
        find: [
          authorize(),
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
          applyGrant(),
        ],
        create: [
          /*
          * The create route is unauthenticated so clients can POST events
          */
          this.transformCorrelator,
        ],
        update: [
          authorize(),
        ],
        patch: [
          authorize(),
        ],
        remove: [
          authorize(),
        ],
      },
      after: {
        create: [
          this.denormalizeType,
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
