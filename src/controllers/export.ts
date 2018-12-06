/**
 * The Export controller is responsible for generating a file download
 * containing entries matching a specific type
 */

import authentication from '@feathersjs/authentication';
import cookieParser from 'cookie-parser';
import db from '../models';

import QueryStream from 'pg-query-stream';
import JSONStream from 'jsonstream'

export default (app) => {
  app.post('/export',
    cookieParser(),
    authentication.express.authenticate('jwt'),
    (req, res, next) => {
      db.sequelize.connectionManager.getConnection().then((pgConn) => {
        const query = new QueryStream('SELECT * FROM events WHERE type = $1 AND "createdAt" > $2 AND "createdAt" <= $3', [
          req.body.type,
          req.body.startDate,
          req.body.endDate
        ]);
        const stream = pgConn.query(query);
        res.writeHead(200, {
          'Content-Disposition' : `attachment; filename=${req.body.type}-${req.body.startDate}.json`,
          'Content-Type': 'application/json',
        });
        stream.pipe(JSONStream.stringify(false)).pipe(res);
        stream.on('end', () => {
          res.end();
        });
      })
      .catch((err) => { console.log(err.stack); next(err); });
    });
};
