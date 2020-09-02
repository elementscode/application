import { ServerRequest } from './server-request';
import { Application } from './application';
import { debug } from './debug';
import {
  NotAuthorizedError,
  NotFoundError,
} from '@elements/error';

export interface IAppMiddlewareOpts {
  app: Application;
}

export class AppMiddleware {
  app: Application

  constructor(opts: IAppMiddlewareOpts) {
    this.app = opts.app;

    if (typeof this.app !== 'object') {
      throw new Error(`AppMiddleware requires the 'app' option but got '${typeof this.app} instead'.`);
    }
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    let found: boolean = await this.app.run(req.parsedUrl.pathname, req)

    if (!found) {
      req.status(404);
      this.app.fire('notFoundError', [new NotFoundError(`${req.url} was not found.`)], req)
      return;
    }

    return next();
  }
}
