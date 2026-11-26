import { Forbidden, NotAuthenticated } from '@feathersjs/errors';

import authorize, { SKIP_KEY, skippable } from '../../src/hooks/authorize';

describe('The `authorize` hook', () => {
  let context = null;
  let mockServices = {};
  const mockApp = {
    defaultAuthentication: () => {
      return { authenticate: () => Promise.resolve({}) };
    },
    service: (name) => { return mockServices; },
  };

  beforeEach(() => {
    context = {
      type: 'before',
      app: mockApp,
      params: {
        query: {},
      },
      data: {
      },
    };
  })

  describe('in testing mode', () => {
    it('should not skip when a `testing_access_token` is omitted', () => {
      return expect(authorize()(context)).rejects.toThrow(Forbidden);
    });

    it('should skip the remaining hooks when a `testing_access_token` is provided', async () => {
      context.params.query.testing_access_token = true;
      const result = await authorize()(context);
      expect(result.params[SKIP_KEY]).toBe(true);
    });
  });

  describe('with the allowInternal option', () => {
    it('should not skip for external API calls', () => {
      context.params.provider = 'rest';
      return expect(authorize({ allowInternal: true })(context))
        .rejects.toThrow(NotAuthenticated);
    });

    it('should skip the remaining hooks for internal API calls', async () => {
      const result = await authorize({ allowInternal: true })(context);
      expect(result.params[SKIP_KEY]).toBe(true);
    });
  });

  describe('skippable()', () => {
    it('runs the wrapped hooks normally', async () => {
      const hook = jest.fn().mockResolvedValue(context);
      await skippable([hook])[0](context);
      expect(hook).toHaveBeenCalledWith(context);
    });

    it('bypasses the wrapped hooks for flagged calls', async () => {
      const hook = jest.fn();
      context.params[SKIP_KEY] = true;
      await skippable([hook])[0](context);
      expect(hook).not.toHaveBeenCalled();
    });
  });
});
