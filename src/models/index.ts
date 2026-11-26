'use strict';

import { Sequelize } from 'sequelize';

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../config/database')[env];

const db : any = {};
const sequelize = new Sequelize(config.url, {
  logging: !!process.env.DB_TRACING,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: env === 'production' ? true : false
    }
  },
  pool: {
    max: 10,
    min: 1,
    acquire: 30000,
    idle: 10000
  },
});

/*
 * Models are defined by the services which use them (see src/services/*.ts):
 * `sequelize.import()` was removed in Sequelize 6.
 */
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
