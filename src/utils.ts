import * as path from 'path';
import * as createDebugger from 'debug';

export let debug = createDebugger('@elements/application');

/**
 * Given a cookie string like one from req.headers['cookie'] or document.cookie,
 * extracts the cookie value with the specific key, or undefined if that cookie
 * doesn't exist in the string.
 */
export function extractCookie(cookies: string | string[] | undefined): string | undefined {
  let re = new RegExp("session=([^;]+)");
  let match;

  if (typeof cookies === 'string') {
    match = cookies.match(re);

    if (match) {
      return match[1];
    }
  }

  else if (Array.isArray(cookies)) {
    for (let idx = 0; idx < cookies.length; idx++) {
      match = cookies[idx].match(re);

      if (match) {
        return match[1];
      }
    }
  }

  else {
    return undefined;
  }
}
