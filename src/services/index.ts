import events from './events';
import grants from './grants';
import types from './types';
import users from './users';

export default (app) => {
  app.configure(events);
  app.configure(grants);
  app.configure(types);
  app.configure(users);
};
