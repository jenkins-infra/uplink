
import logger from './logger';
import path from 'path';
import { URL } from 'url';

/*
 * Express-relateed imports that we need because this is running primarily over
 * REST
 */
import cookieParser from 'cookie-parser';
import favicon from 'serve-favicon';
import compress from 'compression';
import helmet from 'helmet';

import * as Sentry from '@sentry/node';
/**/


/*
 * Feathers specific imports for setting up the application
 */
import { feathers } from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import { AuthenticationService } from '@feathersjs/authentication';
import { oauth } from '@feathersjs/authentication-oauth';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import express, {
  rest,
  json,
  urlencoded,
  serveStatic,
  notFound,
  errorHandler,
} from '@feathersjs/express';
/**/


import middleware from './middleware';
import services from './services';
import { appHooks } from './app.hooks';
import { CookieJWTStrategy, GitHubStrategy } from './authentication';

import Admin from './controllers/admin';
import Dashboard from './controllers/dashboard';
import Export from './controllers/export';

const app = express(feathers());
const settings = configuration();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN })
  /*
   * Cannot case to RequestHandler per Sentry's docs due to compilation error:
   *
   * src/app.ts:48:11 - error TS2352: Type '(req: ClientRequest, res:
   * ServerResponse, next: () => void) => void' cannot be converted to type
   * 'RequestHandler'.
   *   Types of parameters 'req' and 'req' are incompatible.
   *       Type 'Request' is not comparable to type 'ClientRequest'.
   *             Property 'aborted' is missing in type 'Request'.
   *
   *             48   app.use(Sentry.Handlers.requestHandler() as
   *             RequestHandler);
   */
  app.use(Sentry.Handlers.requestHandler() as any);
  logger.info('Sentry configured and installed');
}

// Load app configuration
app.configure(settings);
// Enable security, compression, favicon and body parsing
app.use(helmet());
/*
 * The only inline code in the UI is the <script> block and the onchange
 * handler in views/dashboard.pug, the <style> block in public/index.html, and
 * the <style> block in the HTML error pages of @feathersjs/errors.
 * If any of those change, their hashes below need to be updated, e.g.:
 *   printf '%s' 'navigateToType()' | openssl dgst -sha256 -binary | base64
 * (for the blocks, hash the exact text between the opening and closing tags of
 * the rendered page; browsers report the expected hash in the console when a
 * CSP violation occurs).
 */
app.use(helmet.contentSecurityPolicy({
  browserSniff: false,
  directives: {
    defaultSrc: ["'none'"],
    scriptSrc: [
      "'unsafe-hashes'",
      // views/dashboard.pug <script> block
      "'sha256-u3ra5HoIYc6P8wJ2lPIuBjgPx/xgo/pHroYhN+nljzQ='",
      // views/dashboard.pug onchange='navigateToType()'
      "'sha256-lZMDCYT2BxPOvzTyOkucGevIheGU1JvOsZua4AZCA+k='",
    ],
    styleSrc: [
      'https://stackpath.bootstrapcdn.com',
      // public/index.html <style> block
      "'sha256-XWrUJwBrG68A7uDUSBXnTUd0sUtC8ttBT46YkKQh+Rc='",
      // <style> block of the HTML error pages in @feathersjs/errors
      "'sha256-urzFO9l9c2/6L/L55mbHyyId9UmAPnL5eRDLC4XV9hU='",
    ],
    imgSrc: ["'self'", 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
  },
}));
/*
 * No cross-origin browser client exists: Jenkins submits events server-side,
 * and the UI is same-origin. So there's no CORS support, and state-changing
 * requests sent by a browser on behalf of another site or origin are rejected
 * (CSRF defense in addition to the SameSite cookie, which does not protect
 * against other origins on the same site). Non-browser clients send neither
 * header and are unaffected.
 */
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const fetchSite = req.get('Sec-Fetch-Site');
  if (fetchSite) {
    if ((fetchSite === 'same-origin') || (fetchSite === 'none')) {
      return next();
    }
    return next(new Forbidden('Cross-origin requests are not allowed'));
  }

  // Fallback for browsers not sending Fetch Metadata request headers
  const origin = req.get('Origin');
  if (origin) {
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch (err) {
      // 'null' or otherwise unparseable
    }
    if (originHost !== req.get('Host')) {
      return next(new Forbidden('Cross-origin requests are not allowed'));
    }
  }

  return next();
});
app.use(compress());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', serveStatic(app.get('public')));

/*
 * Enabling the cookie parser on all requests to make sure we can use the JWT
 * authentication wherever we damn well please
 */
app.use(cookieParser());

/*
 * Ensure that POST calls which have _method set to DELETE get passed through
 * properly
 */
app.post('*', (req, res, next) => {
  if (req.body?._method == 'DELETE') {
    req.method = req.body._method;
  }
  next();
});

// Set up Plugins and providers (this also parses the Authorization header)
app.configure(rest());

if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET is not set — tokens are signed with the insecure default from config/default.json. Set JWT_SECRET in the environment for any non-development deployment.');
}
if (!process.env.CLIENT_SECRET) {
  logger.warn('CLIENT_SECRET is not set — using the GitHub OAuth client secret from config/default.json. Set CLIENT_SECRET in the environment for any non-development deployment.');
}
/*
 * The configuration object is shared with node-config: copy the sections we
 * override from the environment instead of mutating them in place.
 */
const authSettings = app.get('authentication');
const githubSettings = authSettings.oauth.github;
app.set('authentication', {
  ...authSettings,
  secret: process.env.JWT_SECRET || authSettings.secret,
  oauth: {
    ...authSettings.oauth,
    defaults: {
      ...authSettings.oauth.defaults,
      // The public origin used to build the GitHub OAuth callback URL
      ...(process.env.OAUTH_ORIGIN ? { origin: process.env.OAUTH_ORIGIN } : {}),
    },
    github: {
      ...githubSettings,
      key: process.env.CLIENT_ID || githubSettings.key,
      secret: process.env.CLIENT_SECRET || githubSettings.secret,
    },
  },
});

const authService = new AuthenticationService(app);
authService.register('jwt', new CookieJWTStrategy());
authService.register('github', new GitHubStrategy());
app.use('authentication', authService);

app.configure(oauth());

/*
 * POST /authentication with no credentials (or any other external call) must
 * not issue a JWT. No legitimate caller in this application uses the
 * authentication service through REST: telemetry submissions go directly to
 * /events (unauthenticated), and dashboard/admin sessions are established via
 * the GitHub OAuth flow.
 */
app.service('authentication').hooks({
  before: {
    create: [
      (context) => {
        /*
         * Tokens are only ever issued by the GitHub OAuth callback, which
         * calls authentication.create() with the profile that GitHub returned
         * to the server (see the `viaOAuthCallback` marker below). Anything
         * else arriving through REST would make the service sign whatever
         * payload it's given.
         */
        if (context.params.provider && !(context.params as any).viaOAuthCallback) {
          throw new NotAuthenticated('Authentication credentials are required');
        }
      },
    ],
  },
});

/*
 * Mark calls reaching the OAuth callback (server-side, not settable by
 * clients) and turn the access token it issues into the JWT cookie used by
 * the browser UI, then redirect to the dashboard.
 */
app.service('auth/:provider/callback').hooks({
  around: {
    all: [
      async (context, next) => {
        (context.params as any).viaOAuthCallback = true;
        await next();
        const accessToken = context.result?.accessToken;
        if (!accessToken) {
          return;
        }
        const cookieSettings = app.get('authentication').cookie;
        const attributes = [
          `${cookieSettings.name}=${accessToken}`,
          'Path=/',
          'Max-Age=86400',
          `SameSite=${cookieSettings.sameSite || 'lax'}`,
        ];
        if (cookieSettings.httpOnly) {
          attributes.push('HttpOnly');
        }
        if (cookieSettings.secure) {
          attributes.push('Secure');
        }
        context.http = {
          ...context.http,
          headers: {
            ...context.http?.headers,
            'Set-Cookie': attributes.join('; '),
          },
        };
      },
    ],
  },
});

app.set('view engine', 'pug');

Dashboard(app);
Export(app);
Admin(app);

(app as any).get('/logout',
  cookieParser(),
  (req, res, next) => {
    res.clearCookie(app.get('authentication').cookie.name);
    res.redirect('/');
  });


// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
// Set up our services (see `services/index.js`)
app.configure(services);

// The error handler must be before any other error middleware
app.use(Sentry.Handlers.errorHandler() as any);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(errorHandler({ logger }));

app.hooks(appHooks);

export default app;
