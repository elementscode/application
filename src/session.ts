import { ISessionOptions } from './types';
import { debug } from './debug';
import { createSessionId } from './server-session';
import { 
  withDefaultValue,
  getUtcTimeNow,
  getUtcDate,
} from '@elements/utils';

const SESSION_FORMAT_VERSION = 1;

export class Session {
  /**
   * The cookie name (defaults to session).
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
    this.key = opts.key || 'session';
    this.id = this.createId();
    this.signatureVerified = true;
    this.csrf = '';
    this.loggedInExpires = opts.loggedInExpires;
    this.loggedOutExpires = opts.loggedOutExpires;
    this.password = opts.password;
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
    return createSessionId();
  }
}

/**
 * Given a cookie string like one from req.headers['cookie'] or document.cookie,
 * extracts the cookie value with the specific key, or undefined if that cookie
 * doesn't exist in the string.
 */
export function extractCookie(cookies: string | string[] | undefined, opts: ISessionOptions = {}): string | undefined {
  let key = opts.key || 'session';
  let re = new RegExp(`${key}=([^;]+)`);
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
