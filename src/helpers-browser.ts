import { Session } from './session';
import { BROWSER_KEY } from './start-browser';
import { IServiceHost } from './types';

export function call<T = any>(host: IServiceHost, method: string, ...args: any[]): Promise<T> {
  return window[BROWSER_KEY].call(method, ...args);
}

export function go(url: string, options: any = {}): void {
  return window[BROWSER_KEY].go(url, options);
}
