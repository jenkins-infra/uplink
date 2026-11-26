/**
 * This service is a simple little users service to provide DB-backed
 * persistence to our authentication provider
 */
import { authenticate } from '@feathersjs/authentication';
import { HookOptions } from '@feathersjs/feathers';
import { SequelizeService } from 'feathers-sequelize';
import { NotAuthenticated } from '@feathersjs/errors';

import db from '../models';
import User from '../models/user';

export const usersHooks : HookOptions<any, any> = {
  before: {
    all: [
      authenticate('jwt'),
      (context) => {
        if (context.params.provider) {
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
  app.use('/users', new SequelizeService({ Model, multi: true }) as any);
  app.service('users').hooks(usersHooks);
}
