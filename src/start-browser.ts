import { Browser } from './browser';
import { Application } from './application';

export const BROWSER_KEY = '_browser';

/**
 * Navigate to a url.
 *
 * @param url - The url path to navigate to.
 * @param options - You can provide the replace: true option to replace the url
 * rather than push a url onto the push state stack.
 *
 */
export function go(url: string, options: any = {}): void {
  window[BROWSER_KEY].go(url, options);
}

/**
 * Start the browser application.
 *
 */
export function start(load: () => Application | { default: Application }) {
  if (window[BROWSER_KEY]) {
    let browser: Browser = window[BROWSER_KEY];
    browser.app = getAppFromCallback(load);
  } else {
    // cold start
    let browser: Browser = new Browser({ app: getAppFromCallback(load) });
    window[BROWSER_KEY] = browser;
    browser.start();
  }
}

function getAppFromCallback(callback: () => Application | { default: Application }): Application {
  let cbExports = callback();
  let app: Application;

  if (cbExports instanceof Application) {
    app = cbExports;
  } else {
    app = cbExports.default;
  }

  if (typeof app === 'undefined') {
    throw new Error(`start(() => require('app')) callback did not return an Application.`)
  }

  return app;
}
