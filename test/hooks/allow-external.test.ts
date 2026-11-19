import { MethodNotAllowed } from '@feathersjs/errors';

import allowExternal from '../../src/hooks/allow-external';

describe('allowExternal hook', () => {
  const hook = allowExternal(['find', 'get']);
  const context = (method : string, provider? : string) => ({
    type: 'before',
    method,
    path: 'things',
    params: provider ? { provider } : {},
  });

  for (const method of ['find', 'get']) {
    it(`allows external '${method}' calls`, () => {
      const ctx = context(method, 'rest');
      expect(hook(ctx)).toBe(ctx);
    });
  }

  for (const method of ['create', 'update', 'patch', 'remove', 'someFutureMethod']) {
    it(`rejects external '${method}' calls with MethodNotAllowed`, () => {
      expect(() => hook(context(method, 'rest'))).toThrow(MethodNotAllowed);
    });

    it(`allows internal '${method}' calls`, () => {
      const ctx = context(method);
      expect(hook(ctx)).toBe(ctx);
    });
  }

  it('rejects everything externally when the allowlist is empty', () => {
    expect(() => allowExternal([])(context('find', 'rest'))).toThrow(MethodNotAllowed);
  });
});
