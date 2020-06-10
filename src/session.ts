import * as http from 'http';
import * as uuid from 'uuid';
import { 
  withDefaultValue,
  getUtcTimeNow,
  getUtcDate,
} from '@elements/utils';
import { sign, verify } from './crypto';
import * as base64Url from 'base64-url';
import { ISessionOptions } from './types';
import {
  debug,
} from './utils';
import { onBeforeSendHeaders } from './headers';

const SESSION_FORMAT_VERSION = 1;

export class Session {
  /**
   * The cookie name (defaults to elements_session).
   */
  key: string;

  /**
   * A unique identifier for the session.
   */
  id: string;

  /**
   * A user id for an authenticated session.
   */
  userId?: string;

  /**
   * A user name/handle for an authenticated session.
   *
   */
  userHandle?: string;

  /**
   * The utc time to expire the token in milliseconds (since unix epoch).
   */
  expires?: number;

  /**
   * A csrf token to prevent cross site scripting.
   */
  csrf: string;

  /**
   * The time in ms the session was created or last updated.
   */
  timestamp: number;

  /**
   * Whether the session has been verified. This means, if the session instance
   * was created from a cookie that was sent to the server from some client, the
   * signature of the cookie matches the signature we compute for the payload of
   * the cookie. If the signatures don't match it means the cookie was tampered
   * with.
   */
  signatureVerified: boolean;

  /**
   * A password used to encrypt/decrypt/sign the session.
   */
  password: string;

  /**
   * The milliseconds before an authenticated session expires.
   */
  loggedInExpires?: number;

  /**
   * The milliseconds before an anonymous session expires.
   */
  loggedOutExpires?: number;

  /**
   * Constructs a new Session instance.
   */
  public constructor(opts: ISessionOptions = {}) {
    this.key = opts.key || 'elements_session';
    this.id = this.createId();
    this.signatureVerified = true;
    this.csrf = '';
    this.loggedInExpires = opts.loggedInExpires;
    this.loggedOutExpires = opts.loggedOutExpires;
    this.password = opts.password || 'p@ssw0rd!!';
    this.setExpiresTime();
    this.touch();
  }

  /**
   * Updates the session's timestamp.
   */
  protected touch() {
    this.timestamp = (new Date).getTime();
  }

  /**
   * If the session was passed up from a client cookie, this will tell us
   * whether the signature was verified. New sessions created on the server are
   * automatically marked as verified.
   */
  public isSignatureVerified(): boolean {
    return this.signatureVerified;
  }

  /**
   * Returns true if the session has expired. This will be true if the expires
   * number (ms utc since unix epoch) is less than or equal to the current utc
   * time in ms.
   */
  public isExpired(): boolean {
    // if this.expires is undefined it means it never expires.
    if (typeof this.expires === 'undefined') {
      return false;
    }

    // otherwise it's expired if the expires timestamp is <= the current
    // timestamp in utc.
    else {
      return this.expires <= getUtcTimeNow();
    }
  }

  /**
   * Returns true if the session signature was verified and the session has not
   * expired.
   */
  public isValid(): boolean {
    return this.isSignatureVerified() && !this.isExpired();
  }

  /**
   * Returns the expires time in ms from the unix epoch. This can be fed into a
   * Date constructor to get a date instance. If there is no expires time this
   * method returns undefined, indicating that the session does not expire.
   */
  public getExpiresTime(): number | undefined {
    return this.expires;
  }

  /**
   * Sets the expire time some ms into the future depending upon whether the
   * session is logged in our logged out.
   */
  protected setExpiresTime(): this {
    if (this.isLoggedIn()) {
      this.expires = this.computeExpiresTime(this.loggedInExpires);
    } else {
      this.expires = this.computeExpiresTime(this.loggedOutExpires);
    }
    return this;
  }

  /**
   * Creates an authenticated session with a userId.
   *
   * Note: This also resets the session id.
   *
   * @param userId - The id for the user.
   * @param [userName] - The userHandle (e.g. cmather) for the user.
   */
  public login(userId: string, userHandle?: string): Session {
    this.reset();
    this.userId = userId;
    this.userHandle = userHandle;
    this.setExpiresTime();
    return this;
  }

  /**
   * Logout the session.
   */
  public logout(): Session {
    this.reset();
    return this;
  }

  /**
   * Adds time to the session, if there's an expiresIn option set.
   */
  public renew(): Session {
    this.setExpiresTime();
    this.touch();
    return this;
  }

  /**
   * Returns true if the session is authenticated. An "authenticated" or
   * "loggedIn" session is one that has a userId stored on it.
   */
  public isLoggedIn(): boolean {
    return !!this.userId;
  }

  /**
   * Resets the session with an undefined userId and expire time. You can also
   * optionally clear the data.
   *
   */
  public reset(): Session {
    // create a new session id.
    this.id = this.createId();

    // clear the user id which will make this an unauthenticated session.
    this.userId = undefined;

    // reset the expires time.
    this.setExpiresTime();

    // set the updated timestamp.
    this.touch();

    return this;
  }

  /**
   * Gets an actual timestamp for the expires value passed to a new session. The
   * expires time is the current utc time + this.expires.
   *
   * @param ms - The number of milliseconds from now.
   *
   */
  protected computeExpiresTime(ms?: number): number | undefined {
    if (typeof ms === 'number') {
      return getUtcTimeNow() + ms;
    }

    else {
      return undefined;
    }
  }

  /**
   * Creates a new session id.
   */
  protected createId(): string {
    try {
      return uuid.v4();
    } catch(err) {
      return '';
    }
  }

  public toCookie(): string {
    let header = {
      v: SESSION_FORMAT_VERSION,
      alg: 'HS256',
    };

    let payload: any = {
      id: this.id,
      userId: this.userId,
      csrf: this.csrf,
      expires: this.expires,
      timestamp: this.timestamp,
    };

    let parts = [
      base64Url.encode(JSON.stringify(header)),
      base64Url.encode(JSON.stringify(payload))
    ];

    let signature = sign(parts.join('.'), this.password);
    let cookie = parts.concat([signature]).join('.');
    let trailers: string[] = [];

    // the cookie is for the root path
    trailers.push(`Path=/`);

    // don't send the cookie when another origin creates a request.
    trailers.push(`SameSite=Strict`);

    // set the expiry
    if (typeof this.expires !== 'undefined') {
      let date = getUtcDate(this.expires);
      trailers.push(`Expires=${date}`);
    }

    return this.key + '=' + cookie + '; ' + trailers.join('; ');
  }

  /**
   * Sets the session cookie on the response object and returns the response.
   *
   * @param res The response object.
   * @param session The session object.
   * @param key The cookie name (e.g. 'session').
   */
  public setCookieOnHttpResponse(res: http.ServerResponse): this {
    // then set the cookie header in the response.
    let cookies = <string[] | string | undefined>res.getHeader('Set-Cookie');

    if (typeof cookies === 'string') {
      cookies = [cookies];
    }

    else if (typeof cookies === 'undefined') {
      cookies = [];
    }

    let cookie = this.toCookie();
    cookies.push(cookie);
    res.setHeader('Set-Cookie', cookies);
    return this;
  }

  public static createFromCookie(cookie: string, opts: ISessionOptions): Session {
    if (typeof cookie === 'undefined') {
      return new Session(opts);
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

  /**
   * Creates a session from an http request and ensures the session is set on
   * the http response.
   */
  public static createFromHttp(req: http.IncomingMessage, res: http.ServerResponse, opts: ISessionOptions): Session {
    let cookie = extractCookie(<string | string[] | undefined>req.headers['cookie']);
    let session = Session.createFromCookie(cookie, opts);
    onBeforeSendHeaders(res, () => session.setCookieOnHttpResponse(res));
    return session;
  }
}

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
