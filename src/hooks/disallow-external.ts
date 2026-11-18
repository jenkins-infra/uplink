import { MethodNotAllowed } from '@feathersjs/errors';

/**
 * Reject calls to a service method that arrive through a transport (REST),
 * while still allowing internal, server-side calls.
 */
export default () => {
  return (context) => {
    if (context.params.provider) {
      throw new MethodNotAllowed(`Method '${context.method}' is not allowed on '${context.path}'`);
    }
    return context;
  };
};
