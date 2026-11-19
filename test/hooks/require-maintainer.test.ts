import { Forbidden } from '@feathersjs/errors';

import { requireMaintainer } from '../../src/services/grants';

describe('requireMaintainer hook', () => {
  let context;
  let mockGrantsService;

  beforeEach(() => {
    mockGrantsService = {
      find: jest.fn().mockResolvedValue([]),
    };
    context = {
      type: 'before',
      params: {
        provider: 'rest',
        user: null,
      },
      app: {
        service: () => mockGrantsService,
      },
    };
  });

  it('passes through for internal service calls (no provider)', async () => {
    delete context.params.provider;
    const result = await requireMaintainer(context);
    expect(result).toBe(context);
    expect(mockGrantsService.find).not.toHaveBeenCalled();
  });

  it('throws Forbidden for anonymous tokens (null user)', async () => {
    context.params.user = null;
    await expect(requireMaintainer(context)).rejects.toThrow(Forbidden);
  });

  it('throws Forbidden for tokens with no GitHub identity', async () => {
    context.params.user = { someOtherProp: true };
    await expect(requireMaintainer(context)).rejects.toThrow(Forbidden);
  });

  it('throws Forbidden for a GitHub user with no grants', async () => {
    context.params.user = { github: { profile: { username: 'outsider' } } };
    mockGrantsService.find.mockResolvedValue([]);
    await expect(requireMaintainer(context)).rejects.toThrow(Forbidden);
  });

  it('throws Forbidden for a GitHub user with only narrow (non-wildcard) grants', async () => {
    context.params.user = { github: { profile: { username: 'limited' } } };
    mockGrantsService.find.mockResolvedValue([{ name: 'limited', type: 'jest-example' }]);
    await expect(requireMaintainer(context)).rejects.toThrow(Forbidden);
  });

  it('passes for a GitHub user with a wildcard admin grant', async () => {
    context.params.user = { github: { profile: { username: 'maintainer' } } };
    mockGrantsService.find.mockResolvedValue([{ name: 'maintainer', type: '*' }]);
    const result = await requireMaintainer(context);
    expect(result).toBe(context);
  });

  it('looks up grants by GitHub username', async () => {
    context.params.user = { github: { profile: { username: 'alice' } } };
    mockGrantsService.find.mockResolvedValue([{ name: 'alice', type: '*' }]);
    await requireMaintainer(context);
    expect(mockGrantsService.find).toHaveBeenCalledWith({
      query: { name: 'alice' },
    });
  });
});
