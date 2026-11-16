/**
 * The Dashboard controller is responsible for stiching the /dashboard data
 * together
 */

import { authenticate } from '@feathersjs/express';

export default (app) => {
  app.get('/dashboard',
    authenticate('jwt'),
    async (req, res, next) => {
      const query = Object.assign({
        $sort: {
          id: -1,
        }
      }, req.query);
      const user = req.feathers.user;
      const name : string = user.github.profile.username;
      const grants : Array<string> = await app.service('grants').find({ query: { name: name }});
      const types : Array<Object> = await app.service('types').find();
      const isAdmin : boolean = (grants.filter(g => g != '*').length > 0);

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
