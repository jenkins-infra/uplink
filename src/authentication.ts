import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { oauth, OAuthStrategy } from '@feathersjs/authentication-oauth';

/*
 * The REST API (events/types/grants/users) authenticates via the standard
 * `Authorization: Bearer <token>` header. The server-rendered pages
 * (/admin, /dashboard, /export) predate that convention and rely on the
 * `uplink-jwt` cookie set at login time, so this strategy falls back to the
 * cookie when no Authorization header is present.
 */
class CookieJWTStrategy extends JWTStrategy {
  async parse(req) {
    const parsed = await super.parse(req);
    if (parsed) {
      return parsed;
    }

    const { cookie = {} } : any = this.authentication.configuration;
    const accessToken = cookie.enabled && req.cookies && req.cookies[cookie.name];

    if (!accessToken) {
      return null;
    }

    return {
      strategy: this.name,
      accessToken: accessToken,
    };
  }
}

/*
 * GitHub returns its raw /user API profile (login, id, name, ...). The rest
 * of the app (views, the `authorize` hook) expects the passport-github
 * shape (`profile.username`, `profile.displayName`) that used to be stored
 * under `user.github.profile`, so we normalize and preserve that here.
 */
class GithubStrategy extends OAuthStrategy {
  async getProfile(data, params) {
    const profile = await super.getProfile(data, params);

    return {
      ...profile,
      username: profile.login,
      displayName: profile.name || profile.login,
    };
  }

  async getEntityData(profile, entity, params) {
    const baseData = await super.getEntityData(profile, entity, params);

    return {
      ...baseData,
      github: { profile },
    };
  }

  async getRedirect(data) {
    const { oauth: oauthConfig } = this.authentication.configuration;

    if (data && data.accessToken) {
      return (oauthConfig && oauthConfig.redirect) || '/';
    }
    // Authentication failed: fall back to the default JSON error response
    return null;
  }
}

/*
 * After a successful GitHub login, store the access token in the
 * `uplink-jwt` cookie (matching the legacy `successRedirect` + cookie
 * behaviour) instead of Feathers' default SPA-oriented `#access_token=`
 * URL fragment.
 */
const setCookieHook = () => async context => {
  const { accessToken } = context.result || {};

  if (!accessToken) {
    return context;
  }

  const { cookie = {} } = context.app.get('authentication');

  if (!cookie.enabled) {
    return context;
  }

  context.http = {
    ...context.http,
    headers: {
      ...(context.http && context.http.headers),
      'Set-Cookie': `${cookie.name}=${accessToken}; HttpOnly; Path=/${cookie.secure ? '; Secure' : ''}`,
    },
  };

  return context;
};

export default app => {
  const authService = new AuthenticationService(app);

  authService.register('jwt', new CookieJWTStrategy());
  authService.register('github', new GithubStrategy());

  app.use('authentication', authService);
  app.configure(oauth());

  app.service('oauth/:provider/callback').hooks({
    after: {
      all: [setCookieHook()],
    },
  });
};
