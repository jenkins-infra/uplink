/*
 * Authentication strategies for Uplink:
 *
 *  - `jwt`: the standard Feathers JWT strategy, which additionally accepts the
 *    token from the session cookie set after the GitHub login (the browser UI
 *    cannot send an Authorization header)
 *  - `github`: the GitHub OAuth login, storing the GitHub profile on the user
 */
import { JWTStrategy } from '@feathersjs/authentication';
import { OAuthStrategy, OAuthProfile } from '@feathersjs/authentication-oauth';

export class CookieJWTStrategy extends JWTStrategy {
  async parse(req : any) {
    const fromHeader = await super.parse(req);
    if (fromHeader) {
      return fromHeader;
    }

    const cookieName : string = (this.authentication.configuration as any).cookie?.name;
    const accessToken = cookieName ? req.cookies?.[cookieName] : null;
    if (typeof accessToken !== 'string' || accessToken === '') {
      return null;
    }
    return { strategy: this.name, accessToken };
  }

  /*
   * A valid-but-anonymous JWT (signed by us, but without a `sub`) must still
   * authenticate, resolving to an empty user which has no GitHub identity: the
   * authorization hooks then reject it with a 403 rather than a 400/500
   * coming from a lookup of an undefined user ID.
   */
  async getEntity(id : any, params : any) {
    if (id === undefined || id === null) {
      return {};
    }
    return super.getEntity(id, params);
  }
}

export class GitHubStrategy extends OAuthStrategy {
  async getEntityData(profile : OAuthProfile, existingEntity : any, params : any) {
    const base = await super.getEntityData(profile, existingEntity, params);
    const username : string = profile.login;

    return {
      ...base,
      github: {
        profile: {
          id: String(profile.id),
          username: username,
          displayName: profile.name || username,
        },
      },
    };
  }

  /*
   * The users service is only reachable internally, so there is no need for
   * the (provider-aware) re-fetch of the entity done by the default one
   */
  async getEntity(result : any, _params : any) {
    return result;
  }

  /*
   * On success, go to the configured page without leaking the access token in
   * the URL: the browser gets it as a cookie instead
   */
  async getRedirect(data : any, params : any) {
    if (data?.accessToken) {
      return this.authentication.configuration.oauth.redirect;
    }
    return super.getRedirect(data, params);
  }
}
