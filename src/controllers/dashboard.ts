/**
 * The Dashboard controller is responsible for stiching the /dashboard data
 * together
 */

import { authenticate } from '@feathersjs/express';
import { Forbidden } from '@feathersjs/errors';
import cookieParser from 'cookie-parser';

export default (app) => {
  app.get('/dashboard',
    cookieParser(),
    authenticate('jwt'),
    async (req, res, next) => {
      const query = Object.assign({
        $sort: {
          id: -1,
        }
      }, req.query);
      const user = (req as any).feathers.user;
      const name : string = user?.github?.profile?.username;
      if (!name) {
        return next(new Forbidden('No GitHub information, sorry'));
      }
      const grants : Array<any> = await app.service('grants').find({ query: { name: name }});
      const types : Array<Object> = await app.service('types').find();
      const isAdmin : boolean = grants.some(g => g.type === '*');

      app.service('events')
        .find({
          query: query,
          // propogate our user object down
          user: user,
        })
        .then(result =>
          res.render('dashboard', {
            events: result,
            user: user,
            query: req.query,
            isAdmin: isAdmin,
            grants: grants,
            types: types,
          }))
        .catch(next);
  });
};
