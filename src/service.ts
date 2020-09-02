import * as path from 'path';
import { Logger } from './logger';
import { SqlResult, DbConnection, Db } from '@elements/postgres';
import {
  ISessionHost
} from './types';

import {
  NotAuthorizedError,
  NotAcceptableError,
  NotFoundError
} from '@elements/error';
import { Session } from './session';
import { debug } from './debug';

export interface IServiceOpts {
  session: Session;
  logger: Logger;
}

export class Service {
  public session: Session;

  public logger: Logger;

  public constructor(opts: IServiceOpts) {
    this.session = opts.session;
    this.logger = opts.logger;
  }

  public async sql<R extends any = any, A extends any[] = any[]>(text: string, args?: A): Promise<SqlResult<R>> {
    return Db.sql<R, A>(text, args);
  }

  public static create(opts: IServiceOpts): Service {
    return new Service(opts);
  }
}

export interface ICallOptions {
  session: Session;
  logger: Logger;
  method: string;
  args: any[];
}

export async function findAndCallServiceFunction<T = any>(opts: ICallOptions): Promise<T> {
  debug('call %s', opts.method);

  if (typeof opts.method !== 'string' || opts.method.length == 0) {
    throw new NotAcceptableError('Invalid service method name.');
  }

  // remove any file path slashes to sanitize the input.
  let parts = opts.method.replace(/\/|\\/g, '').split('.');

  // the last part of namespace parts will be the method name itself.
  let funcName = parts.pop();

  // the previous parts will be the service directories separated by dots.
  let ns = parts.map(p => p.toLowerCase()).join(path.sep);

  let exports: any;
  let partialPath = path.join(process.cwd(), 'app', 'services', ns)
  try {
    exports = require(partialPath);
  } catch (err) {
    if (/Cannot find module|No module/.test(String(err))) {
      throw new NotFoundError(`Service method ${opts.method} not found.`);
    } else {
      throw err;
    }
  }

  if (typeof exports[funcName] !== 'function') {
    throw new NotFoundError(`The service function ${opts.method} was not found.`);
  }

  let service = new Service({
    session: opts.session,
    logger: opts.logger,
  });

  return exports[funcName].apply(service, opts.args);
}
