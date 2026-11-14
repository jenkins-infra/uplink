/**
 * This service produces a list of types in the system
 */

import { SequelizeService } from 'feathers-sequelize';

import authorize from '../hooks/authorize';
import applyGrant from '../hooks/apply-grant';
import db from '../models';
import Type from '../models/type';

const typesHooks = {
  before: {
    all: [
      authorize({ allowInternal: true, }),
      applyGrant(),
    ],
  },
  after: {},
  error: {},
};

export default (app) => {
  const Model : any = Type(db.sequelize, db.sequelize.Sequelize);
  const typesService = new SequelizeService({ Model: Model });

  // Only expose read/create: /types is denormalized from /events and should
  // not be directly updated, patched or removed by clients
  app.use('/types', typesService, { methods: ['find', 'get', 'create'] });
  app.service('types').hooks(typesHooks);
}
