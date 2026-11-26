import { authenticate } from '@feathersjs/express';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import cookieParser from 'cookie-parser';

export default (app) => {
  app.get('/admin',
    cookieParser(),
    authenticate('jwt'),
    async (req, res, next) => {
      const user = (req as any).feathers.user;
      const name : string = user?.github?.profile?.username;
      if (!name) {
        return next(new Forbidden('No GitHub information, sorry'));
      }

      app.service('grants').find({
        query: {
          $sort: {
            name: 1,
          },
        },
      })
        .then((records) => {
          const isAdmin : boolean = (records.filter(r => (r.name == name) && (r.type == '*')).length > 0);
          if (!isAdmin) {
            throw new NotAuthenticated();
          }
          res.render('admin', {
              user: user,
              grants: records,
          });
        })
        .catch(next);
  });
};
