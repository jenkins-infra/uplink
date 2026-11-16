import logger from '../logger';

/**
 * This hook will apply the grants for the current user to the search query
 */
export default () => {
  return async context => {
    if (context.params.skipGrants) {
      return context;
    }

    const grantedTypes = context.data.grants.filter(g => g != '*');

    if (grantedTypes) {
      /*
       * If there are wildcard grants, we don't need to apply any restrictions
       * to the query
       */
      if (context.data.grants.length > grantedTypes.length) {
        return context;
      }
      Object.assign(context.params.query, {
        'type': grantedTypes,
      });
    }
    return context;
  }
};
