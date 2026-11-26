/* eslint-disable no-console */
import logger from './logger';
import app from './app';

const port : Number = app.get('port');

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled Rejection at: Promise ', p, reason)
);

// In Feathers 5, listen() runs the app `setup` and resolves once listening
app.listen(port).then(() =>
  logger.info('Feathers application started on http://%s:%d', app.get('host'), port)
);
