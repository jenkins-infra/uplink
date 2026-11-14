/**
 * This service is a simple little users service to provide DB-backed
 * persistence to our authentication provider
 */
import { authenticate } from '@feathersjs/authentication';
import { SequelizeService } from 'feathers-sequelize';
import { DataTypes } from 'sequelize';
import { NotAuthenticated, Forbidden } from '@feathersjs/errors';

import authorize from '../hooks/authorize';
import db from '../models';
import User from '../models/user';

export const usersHooks = {
  before: {
    all: [
      authenticate('jwt'),
      (context) => {
        if (context.params.provider == 'rest') {
          throw new NotAuthenticated('This route is not allowed to be publicly accessed');
        }
      },
    ],
  },
  after: {
  },
  error: {
  },
};

export default (app) => {
  const Model : any = User(db.sequelize, db.sequelize.Sequelize);
  app.use('/users', new SequelizeService({ Model }));
  app.service('users').hooks(usersHooks);
}
