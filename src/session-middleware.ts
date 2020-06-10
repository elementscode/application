import { ServerRequest } from './server-request';
import { ISessionOptions, IMiddleware } from './types';
import { Session } from './session';
import { debug } from './utils';

declare module 'http' {
  export interface IncomingMessage {
    session?: Session;
  }
}

export class SessionMiddleware implements IMiddleware {
  private opts: ISessionOptions;

  public constructor(opts: ISessionOptions) {
    this.opts = opts;
  }

  public async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    req.session = Session.createFromHttp(req.req, req.res, this.opts);
    debug('create session %s', req.session.id);
    return next();
  }
}
