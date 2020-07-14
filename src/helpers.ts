import { Session } from './session';

export function call<T = any>(method: string, ...args: any[]): Promise<T> {
  throw new Error(`The call(...) function can only be used in the browser. Try using this.call(...) from your page route function instead.`);
}

export function getSession(): Session {
  throw new Error(`The getSession(function can only be used in the browser. Try using this.session from your page route function instead.`);
}
