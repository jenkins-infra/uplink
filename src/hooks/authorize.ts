import { authenticate } from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';

import logger from '../logger';

/*
 * Feathers 5 no longer has `SKIP` to bypass the remaining hooks. The authorize
 * hook flags the call instead, and the hooks that must be bypassed for such
 * calls are wrapped with `skippable()`.
 */
export const SKIP_KEY = 'skipRemainingHooks';

export const skippable = (hooks : Array<(context : any) => any>) => {
  return hooks.map(hook => async (context) => {
    if (context.params[SKIP_KEY]) {
      return context;
    }
    return hook(context);
  });
};

export interface AuthorizeOptions {
  allowInternal?: boolean,
};

export default (options : AuthorizeOptions = {}) => {
  return async context => {

    /*
     * Allow internal API calls to skip the entire authorization process
     */
    if ((options.allowInternal) &&
        (!context.params.provider)) {
      context.params[SKIP_KEY] = true;
      return context;
    }

    if ((process.env.NODE_ENV == 'test') &&
        (context.params.query.testing_access_token)) {
      // Remove the property to make sure it's not used in the DB query
      delete context.params.query.testing_access_token;
      context.params[SKIP_KEY] = true;
      return context;
    }

    context = await authenticate('jwt')(context);

    /*
     * A valid-but-anonymous JWT (no userId) authenticates successfully but
     * resolves to an empty user object, so a bare `!context.params.user` check
     * passes and then crashes with a 500 on the property access below. Require
     * a real GitHub identity and fail closed with a 403 instead.
     */
    const name : string = context.params.user?.github?.profile?.username;
    if (!name) {
      throw new Forbidden('No GitHub information, sorry');
    }

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
