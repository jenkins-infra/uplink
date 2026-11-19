/**
 * The Export controller is responsible for generating a file download
 * containing entries matching a specific type
 */

import authentication from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';
import cookieParser from 'cookie-parser';
import db from '../models';

import QueryStream from 'pg-query-stream';
import JSONStream from 'jsonstream'

export default (app) => {
  app.post('/export',
    cookieParser(),
    authentication.express.authenticate('jwt'),
    async (req, res, next) => {
      const user = (req as any).user;

      if (!user?.github?.profile?.username) {
        return next(new Forbidden('Authentication required'));
      }

      const username: string = user.github.profile.username;
      let grants;
      try {
        grants = await app.service('grants').find({ query: { name: username } });
      } catch (err) {
        return next(err);
      }

      const grantedTypes: string[] = grants.map((g: any) => g.type);
      const hasWildcard = grantedTypes.includes('*');

      if (!hasWildcard && !grantedTypes.includes(req.body.type)) {
        return next(new Forbidden('Not authorized for this event type'));
      }

      db.sequelize.connectionManager.getConnection().then((pgConn) => {
        /*
         * The connection is checked out of the shared Sequelize pool. It MUST
         * be returned on every exit path (normal end, stream error, or the
         * client hanging up mid-download); otherwise each /export request
         * permanently leaks one of the pool's connections and the whole
         * application loses database access once the pool is drained.
         */
        let released = false;
        const release = () => {
          if (released) {
            return;
          }
          released = true;
          db.sequelize.connectionManager.releaseConnection(pgConn);
        };

        const query = new QueryStream('SELECT * FROM events WHERE type = $1 AND "createdAt" > $2 AND "createdAt" <= $3', [
          req.body.type,
          req.body.startDate,
          req.body.endDate
        ]);
        const stream = pgConn.query(query);

        // Client disconnected before the download finished.
        res.on('close', release);

        stream.on('error', (err) => {
          release();
          if (!res.headersSent) {
            next(err);
          } else {
            // Streaming already started, so we can't send a clean error
            // response; just tear the connection down.
            res.destroy(err);
          }
        });

        res.writeHead(200, {
          'Content-Disposition' : `attachment; filename=${req.body.type}-${req.body.startDate}.json`,
          'Content-Type': 'application/json',
        });
        stream.pipe(JSONStream.stringify(false)).pipe(res);
        stream.on('end', () => {
          release();
          res.end();
        });
      })
      .catch((err) => { console.log(err.stack); next(err); });
    });
};
