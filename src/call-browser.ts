import { BROWSER_KEY } from './start-browser';
export function call<T = any>(method: string, ...args: any[]): Promise<T> {
  return window[BROWSER_KEY].call(method, ...args);
}
