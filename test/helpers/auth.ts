/**
 * Helpers for creating test users and signing JWTs in acceptance tests.
 *
 * Uses app.passport.createJWT so tokens are signed with the same secret and
 * options the application uses, without coupling tests to the JWT structure.
 */

export async function createTestUser(app, { githubId, username }: { githubId: number, username: string }) {
  return app.service('users').create({
    githubId,
    github: {
      profile: { id: String(githubId), username, displayName: username },
      accessToken: 'test-access-token',
    },
  });
}

export async function mintToken(app, userId: number): Promise<string> {
  return (app as any).passport.createJWT({ userId }, app.get('authentication'));
}

export async function createTestGrant(app, name: string, type: string) {
  return app.service('grants').create({ name, type });
}

export async function cleanupTestUser(app, githubId: number) {
  await app.service('users').remove(null, { query: { githubId, $limit: 10 } });
}

export async function cleanupTestGrant(app, name: string) {
  await app.service('grants').remove(null, { query: { name, $limit: 10 } });
}
