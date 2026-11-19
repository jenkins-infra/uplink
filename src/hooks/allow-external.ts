import { MethodNotAllowed } from '@feathersjs/errors';

/**
 * Allowlist of service methods that may be called through a transport (REST).
 *
 * Register this in `before.all` so it applies to every method, including ones
 * without method-specific hooks: anything not listed is rejected for external
 * callers, while internal, server-side calls remain unaffected.
 */
export default (methods : string[]) => {
  const allowed = new Set(methods);
  return (context) => {
    if (context.params.provider && !allowed.has(context.method)) {
      throw new MethodNotAllowed(`Method '${context.method}' is not allowed on '${context.path}'`);
    }
    return context;
  };
};
