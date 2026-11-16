
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
import feathers from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import authentication from '@feathersjs/authentication';
import jwt from '@feathersjs/authentication-jwt';
import oauth2 from '@feathersjs/authentication-oauth2';
import { Strategy } from 'passport-github';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';
/**/


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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', express.static(app.get('public')));

// Set up Plugins and providers
app.configure(express.rest());
app.configure(socketio());

/*
 * Enabling the cookie parser on all requests to make sure we can use the JWT
 * authentication wherever we damn well please
 */
app.get('*', cookieParser());
app.post('*', cookieParser());

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
 * Allow overriding the JWT secret in the environment, a la Kubernetes
 */
app.get('authentication').secret = process.env.JWT_SECRET || app.get('authentication').secret;
app.configure(authentication(app.get('authentication')));

app.configure(jwt());
const githubSettings = app.get('github');

githubSettings.clientID = process.env.CLIENT_ID || githubSettings.clientID;
githubSettings.clientSecret = process.env.CLIENT_SECRET || githubSettings.clientSecret;

app.configure(oauth2(Object.assign(githubSettings, {
  name: 'github',
  Strategy: Strategy,
  successRedirect: '/dashboard',
  scope: [],
})));

app.set('view engine', 'pug');

Dashboard(app);
Export(app);
Admin(app);

app.get('/logout',
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
app.use(express.notFound());
app.use(express.errorHandler({ logger }));

app.hooks(appHooks);

export default app;
