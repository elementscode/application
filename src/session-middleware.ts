import * as http from 'http';
import { ISessionOptions } from './types';
import { Session } from './session';
import { debug } from './utils';

declare module 'http' {
  export interface IncomingMessage {
    session?: Session;
  }
}

export class SessionMiddleware implements IMiddleware {
  public constructor(opts: ISessionOpts) {
    this.opts = opts;
  }

  public async run(req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>): Promise<void> {
    req.session = Session.createFromHttp(req, res, opts);
    debug('create session %s', req.session.id);
    return next();
  }
}
