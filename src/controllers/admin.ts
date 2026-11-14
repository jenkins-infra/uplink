import { authenticate } from '@feathersjs/express';
import { NotAuthenticated } from '@feathersjs/errors';

export default (app) => {
  app.get('/admin',
    authenticate('jwt'),
    async (req, res, next) => {
      const user = req.feathers.user;
      const name : string = user.github.profile.username;

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
