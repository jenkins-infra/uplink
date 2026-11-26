/**
 * This service produces a list of types in the system
 */

import { HookOptions } from '@feathersjs/feathers';
import { SequelizeService } from 'feathers-sequelize';

import allowExternal from '../hooks/allow-external';
import authorize, { skippable } from '../hooks/authorize';
import applyGrant from '../hooks/apply-grant';
import sanitizeQuery from '../hooks/sanitize-query';
import db from '../models';
import Type from '../models/type';

const typesHooks : HookOptions<any, any> = {
  before: {
    /*
     * Deny by default: only the methods listed here are reachable through
     * REST. Types are only created internally, by the events service when it
     * receives an event of a previously unknown type, and are never modified
     * or removed through the API.
     */
    all: [
      allowExternal(['find', 'get']),
    ],
    find: [
      authorize({ allowInternal: true, }),
      ...skippable([
        sanitizeQuery(['id', 'type', 'createdAt', 'updatedAt']),
        applyGrant(),
      ]),
    ],
    get: [
      authorize({ allowInternal: true, }),
      ...skippable([
        sanitizeQuery(['id', 'type', 'createdAt', 'updatedAt']),
        applyGrant(),
      ]),
    ],
  },
  after: {},
  error: {},
};

export default (app) => {
  const Model : any = Type(db.sequelize, db.sequelize.Sequelize);
  /*
   * Note: `delete typesService.update` etc. does not remove these methods, as
   * they are defined on the Service prototype. External access is restricted
   * by the `allowExternal` hook above instead.
   */
  const typesService = new SequelizeService({ Model: Model, multi: true });

  app.use('/types', typesService as any);
  app.service('types').hooks(typesHooks);
}
