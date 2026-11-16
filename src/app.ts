
import logger from './logger';
import path from 'path';

/*
 * Express-relateed imports that we need because this is running primarily over
 * REST
 */
import cookieParser from 'cookie-parser';
import favicon from 'serve-favicon';
import compress from 'compression';
import helmet from 'helmet';
import cors from 'cors';

import * as Sentry from '@sentry/node';
/**/


/*
 * Feathers specific imports for setting up the application
 */
import { feathers } from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import express, { json, urlencoded, static as serveStatic, rest, notFound, errorHandler } from '@feathersjs/express';
import socketio from '@feathersjs/socketio';
/**/


import authentication from './authentication';
import middleware from './middleware';
import services from './services';
import { appHooks } from './app.hooks';
import channels from './channels';

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
// Enable security, CORS, compression, favicon and body parsing
app.use(helmet());
app.use(cors());
app.use(compress());
app.use(json());
app.use(urlencoded({ extended: true }));
/*
 * `config/*.json`'s `public` setting ("../public/") is a path relative to
 * this file's directory (`src/` in development, `build/` once compiled),
 * not to the process's current working directory. @feathersjs/configuration
 * v2 used to resolve relative-looking config values like this one
 * automatically; v5 no longer does, so it's resolved explicitly here.
 */
const publicPath = path.resolve(__dirname, app.get('public'));
app.use(favicon(path.join(publicPath, 'favicon.ico')));
// Host the public folder
app.use('/', serveStatic(publicPath));

/*
 * Enabling the cookie parser on all requests to make sure we can use the JWT
 * authentication wherever we damn well please. This must run before the REST
 * transport below so that the `uplink-jwt` cookie is available to it.
 */
app.use(cookieParser());

// Set up Plugins and providers
app.configure(rest());
app.configure(socketio());

/*
 * Ensure that POST calls which have _method set to DELETE get passed through
 * properly
 */
app.post('*', (req, res, next) => {
  if (req.body._method == 'DELETE') {
    req.method = req.body._method;
  }
  next();
});

/*
 * Allow overriding the JWT secret and GitHub OAuth app credentials in the
 * environment, a la Kubernetes
 */
const authConfig = app.get('authentication');
authConfig.secret = process.env.JWT_SECRET || authConfig.secret;

authConfig.oauth.github.key = process.env.CLIENT_ID;
authConfig.oauth.github.secret = process.env.CLIENT_SECRET;

app.configure(authentication);

app.set('view engine', 'pug');

Dashboard(app);
Export(app);
Admin(app);

/*
 * @feathersjs/express's v5 typings only declare the single-argument,
 * settings-getter overload of `app.get()`, not Express's route-handler
 * overload, even though the underlying method is still plain Express.
 */
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
// Set up event channels (see channels.js)
app.configure(channels);

// The error handler must be before any other error middleware
app.use(Sentry.Handlers.errorHandler() as any);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(errorHandler({ logger }));

app.hooks(appHooks);

export default app;
