import { hot, IDistJsonFileChangeSets } from '@elements/runtime';
import { Server } from './server';
import { Application } from './application';

export function start(load: () => Application | { default: Application }) {
  let app = getAppFromCallback(load);

  let server = new Server({
    app: app,
    env: process.env.ENV || 'dev',
  });

  hot((changed: IDistJsonFileChangeSets) => {
    server.restart(getAppFromCallback(load), changed);
  });

  server.start();
}

function getAppFromCallback(callback: () => Application | { default: Application }): Application {
  let exports = callback();
  let app: Application;

  if (exports instanceof Application) {
    app = exports;
  } else {
    app = exports.default;
  }

  if (typeof app === 'undefined') {
    throw new Error(`start(() => require('app')) callback did not return an Application.`)
  }

  return app;
}
