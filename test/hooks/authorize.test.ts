import { Forbidden } from '@feathersjs/errors';

import authorize from '../../src/hooks/authorize';

describe('The `authorize` hook', () => {
  let context = null;
  let mockServices = {};
  const mockAuthService = {
    authenticate: () => Promise.resolve({}),
  };
  const mockApp = {
    defaultAuthentication: () => mockAuthService,
    service: (name) => { return mockServices; },
  };

  beforeEach(() => {
    context = {
      type: 'before',
      app: mockApp,
      params: {
        query: {},
        // A truthy value so the `authenticate` hook calls into our mocked
        // authentication service instead of treating this as an
        // unauthenticated external call
        authentication: {},
      },
      data: {
      },
    };
  })

  describe('in testing mode', () => {
    it('should not skip when a `testing_access_token` is omitted', () => {
      return expect(authorize()(context)).rejects.toThrow(Forbidden);
    });

    it('should skip authorization when a `testing_access_token` is provided', async () => {
      context.params.query.testing_access_token = true;
      const result = await authorize()(context);
      expect(result.params.skipGrants).toEqual(true);
    });
  });

  describe('with the allowInternal option', () => {
    it('should not skip for external API calls', () => {
      context.params.provider = 'rest';
      return expect(authorize({ allowInternal: true })(context))
        .rejects.toThrow(Forbidden);
    });

    it('should skip authorization for internal API calls', async () => {
      const result = await authorize({ allowInternal: true })(context);
      expect(result.params.skipGrants).toEqual(true);
    });
  });
});
