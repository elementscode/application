import { ServerRequest } from './server-request';
import { Application } from './application';
import { debug } from './utils';
import {
  NotAuthorizedError,
  NotFoundError,
} from './errors';

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
      if (this.app['_onNotFoundErrorCb']) {
        this.app['_onNotFoundErrorCb'].call(req, new NotFoundError(`${req.url} was not found.`));
      }
    }

    return next();
  }
}
