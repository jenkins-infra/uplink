import { authenticate } from '@feathersjs/authentication';
import { SequelizeService } from 'feathers-sequelize';
import { DataTypes } from 'sequelize';

import logger from '../logger';
import db from '../models';
import Grant from '../models/grant';

export const grantHooks = {
  before: {
    all: [
      authenticate('jwt'),
    ],
  },
  after: {
  },
  error: {
  },
};

export default (app) => {
  const Model : any = Grant(db.sequelize, db.sequelize.Sequelize);
  app.use('/grants', new SequelizeService({ Model }));
  app.service('grants').hooks(grantHooks);
}
