import { Session } from './session';
import { findAndCallServiceFunction } from './service';
import { IServiceHost } from './types';

export function call<T = any>(host: IServiceHost, method: string, ...args: any[]): Promise<T> {
  return findAndCallServiceFunction<T>({
    method: method,
    args: args,
    session: host && typeof host['getSession'] == 'function' ? host.getSession() : undefined,
    logger: host && typeof host['getLogger'] == 'function' ? host.getLogger() : undefined,
  })
}

export function getSession(): Session {
  return undefined;
}

export function go(url: string, options: any = {}): void {
  // noop on the server.
}
