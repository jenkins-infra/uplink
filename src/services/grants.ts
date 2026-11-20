import authentication from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';
import { HooksObject } from '@feathersjs/feathers';
import service from 'feathers-sequelize';
import { DataTypes } from 'sequelize';

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

export const grantHooks : HooksObject = {
  before: {
    all: [
      authentication.hooks.authenticate(['jwt']),
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
  app.use('/grants', service({ Model }));
  app.service('grants').hooks(grantHooks);
}
