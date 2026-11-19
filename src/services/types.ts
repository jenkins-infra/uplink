/**
 * This service produces a list of types in the system
 */

import { Params, HooksObject } from '@feathersjs/feathers';
import service from 'feathers-sequelize';

import authorize from '../hooks/authorize';
import applyGrant from '../hooks/apply-grant';
import disallowExternal from '../hooks/disallow-external';
import sanitizeQuery from '../hooks/sanitize-query';
import db from '../models';
import Type from '../models/type';

const typesHooks : HooksObject = {
  before: {
    find: [
      authorize({ allowInternal: true, }),
      sanitizeQuery(['id', 'type', 'createdAt', 'updatedAt']),
      applyGrant(),
    ],
    get: [
      authorize({ allowInternal: true, }),
      sanitizeQuery(['id', 'type', 'createdAt', 'updatedAt']),
      applyGrant(),
    ],
    /*
     * Types are only created internally, by the events service when it
     * receives an event of a previously unknown type.
     */
    create: [
      disallowExternal(),
    ],
  },
  after: {},
  error: {},
};

export default (app) => {
  const Model : any = Type(db.sequelize, db.sequelize.Sequelize);
  const typesService = service({ Model: Model });

  delete typesService.update;
  delete typesService.remove;
  delete typesService.patch;

  app.use('/types', typesService);
  app.service('types').hooks(typesHooks);
}
