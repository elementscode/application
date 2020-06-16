import * as http from 'http';
import * as uuid from 'uuid';
import * as base64Url from 'base64-url';
import { onBeforeSendHeaders } from './headers';
import { 
  withDefaultValue,
  getUtcTimeNow,
  getUtcDate,
} from '@elements/utils';
import { ISessionOptions } from './types';
import { Session, extractCookie } from './session';
import { sign, verify } from './crypto';
import { debug } from './debug';

export const SESSION_FORMAT_VERSION = 1;

/**
 * Creates a randomly generated uuid id for a new session.
 */
export function createSessionId(): string {
  return uuid.v4();
}

/**
 * Creates a session from an http request and ensures the session is set on
 * the http response.
 */
export function createSessionFromHttp(req: http.IncomingMessage, res: http.ServerResponse, opts: ISessionOptions): Session {
  let cookie = extractCookie(<string | string[] | undefined>req.headers['cookie']);
  let session = createSessionFromCookie(cookie, opts);
  onBeforeSendHeaders(res, () => setSessionCookieOnHttpResponse(session, res));
  return session;
}

/**
 * Sets the session cookie on the response object and returns the response.
 *
 * @param res The response object.
 * @param session The session object.
 * @param key The cookie name (e.g. 'session').
 */
export function setSessionCookieOnHttpResponse(session: Session, res: http.ServerResponse) {
  // then set the cookie header in the response.
  let cookies = <string[] | string | undefined>res.getHeader('Set-Cookie');

  if (typeof cookies === 'string') {
    cookies = [cookies];
  }

  else if (typeof cookies === 'undefined') {
    cookies = [];
  }

  let cookie = createCookieFromSession(session);
  cookies.push(cookie);
  res.setHeader('Set-Cookie', cookies);
  return this;
}

export function createSessionFromCookie(cookie: string, opts: ISessionOptions): Session {
  if (typeof cookie === 'undefined') {
    let session = new Session(opts);
    session.id = uuid.v4();
    return session;
  }

  // just get the first part of the cookie without the options if there are
  // any
  cookie = cookie.split(';')[0];

  let parts = cookie.split('.');

  // pop the signature off the end
  let signature = <string>parts.pop();

  // and see if we compute the same signature for the rest (i.e. 'verify' the
  // cookie)
  let signatureVerified = verify(parts.join('.'), signature, opts.password);

  // get the payload
  let payload = <string>parts.pop();

  // and the header
  let header = <string>parts.pop();

  // to store the deserialized cookie payload
  let deserialized;

  try {
    // decrypt, base 64 decode and json parse the payload into an object
    deserialized = JSON.parse(base64Url.decode(payload));
  } catch (err) {
    debug(`Error parsing cookie into a Session instance. ${err.message}`);
    return new Session(opts);
  }

  let session = new Session(opts);
  session['id'] = deserialized['id'];
  session['userId'] = deserialized['userId'];
  session['userHandle'] = deserialized['userHandle'];
  session['csrf'] = deserialized['csrf'];
  session['expires'] = deserialized['expires'];
  session['timestamp'] = deserialized['timestamp'];

  if (typeof session.id === 'undefined' || session.isExpired()) {
    return new Session(opts);
  } else if (!signatureVerified) {
    return new Session(opts);
  } else {
    return session;
  }
}

export function createCookieFromSession(session: Session): string {
  let header = {
    v: SESSION_FORMAT_VERSION,
    alg: 'HS256',
  };

  let payload: any = {
    id: session.id,
    userId: session.userId,
    csrf: session.csrf,
    expires: session.expires,
    timestamp: session.timestamp,
  };

  let parts = [
    base64Url.encode(JSON.stringify(header)),
    base64Url.encode(JSON.stringify(payload))
  ];

  let signature = sign(parts.join('.'), session.password);
  let cookie = parts.concat([signature]).join('.');
  let trailers: string[] = [];

  // the cookie is for the root path
  trailers.push(`Path=/`);

  // don't send the cookie when another origin creates a request.
  trailers.push(`SameSite=Strict`);

  // set the expiry
  if (typeof session.expires !== 'undefined') {
    let date = getUtcDate(session.expires);
    trailers.push(`Expires=${date}`);
  }

  return session.key + '=' + cookie + '; ' + trailers.join('; ');
}
