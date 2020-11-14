import { Session } from './session';
import { Logger } from './logger';
import { findAndCallServiceFunction, Service } from './service';
import { IServiceHost } from './types';

export function call<T = any>(host: IServiceHost | Service, method: string, ...args: any[]): Promise<T> {
  let service: Service;
  if (host instanceof Service) {
    service = host;
  } else {
    service = new Service({
      session: host && typeof host['getSession'] == 'function' ? host.getSession() : new Session(),
      logger: host && typeof host['getLogger'] == 'function' ? host.getLogger() : new Logger(),
    });
  }

  return findAndCallServiceFunction<T>({
    service: service,
    method: method,
    args: args,
  });
}

export function go(url: string, options: any = {}): void {
  // noop on the server.
}
