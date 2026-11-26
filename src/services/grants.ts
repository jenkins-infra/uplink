import { authenticate } from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';
import { HookOptions } from '@feathersjs/feathers';
import { SequelizeService } from 'feathers-sequelize';

import logger from '../logger';
import sanitizeQuery from '../hooks/sanitize-query';
import db from '../models';
import Grant from '../models/grant';

export const requireMaintainer = async (context) => {
  if (!context.params.provider) {
    return context;
  }

  if (!context.params.user?.github?.profile?.username) {
    throw new Forbidden('Authentication required');
  }

  const username: string = context.params.user.github.profile.username;
  const grants = await context.app.service('grants').find({
    query: { name: username },
  });

  if (!grants.some((g: any) => g.type === '*')) {
    throw new Forbidden('Not authorized');
  }

  return context;
};

export const grantHooks : HookOptions<any, any> = {
  before: {
    all: [
      authenticate('jwt'),
      requireMaintainer,
    ],
    find: [
      sanitizeQuery(['id', 'name', 'type', 'createdAt', 'updatedAt']),
    ],
    get: [
      sanitizeQuery(['id', 'name', 'type', 'createdAt', 'updatedAt']),
    ],
  },
  after: {
  },
  error: {
  },
};

export default (app) => {
  const Model : any = Grant(db.sequelize, db.sequelize.Sequelize);
  app.use('/grants', new SequelizeService({ Model, multi: true }) as any);
  app.service('grants').hooks(grantHooks);
}
