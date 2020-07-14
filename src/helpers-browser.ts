import { Session } from './session';
import { BROWSER_KEY } from './start-browser';

export function call<T = any>(method: string, ...args: any[]): Promise<T> {
  return window[BROWSER_KEY].call(method, ...args);
}

export function getSession(): Session {
  return window[BROWSER_KEY].getSession();
}
