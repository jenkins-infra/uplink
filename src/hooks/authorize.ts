import { authenticate } from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';

import logger from '../logger';

export interface AuthorizeOptions {
  allowInternal?: boolean,
};

export default (options : AuthorizeOptions = {}) => {
  return async context => {

    /*
     * Allow internal API calls to skip the entire authorization process.
     * `skipGrants` tells the paired `applyGrant` hook not to run, since no
     * grants were looked up in this path.
     */
    if ((options.allowInternal) &&
        (!context.params.provider)) {
      context.params.skipGrants = true;
      return context;
    }

    if ((process.env.NODE_ENV == 'test') &&
        (context.params.query.testing_access_token)) {
      // Remove the property to make sure it's not used in the DB query
      delete context.params.query.testing_access_token;
      context.params.skipGrants = true;
      return context;
    }

    context = await authenticate('jwt')(context);

    if (!context.params.user) {
      throw new Forbidden('No GitHub information, sorry');
    }

    const name : string = context.params.user.github.profile.username;
    const type : string = context.params.query.type;

    return context.app.service('grants').find({
      query: {
        name: name,
      },
    })
      .then((records) => {
        if (records.length === 0) {
          throw new Forbidden('Not allowed, sorry buddy');
        }

        if (!context.data) {
          context.data = {};
        }
        context.data.grants = records.map(r => r.type);
        return context;
      });
  };
};
