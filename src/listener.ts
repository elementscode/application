import * as http from 'http';

import { AssetMiddleware } from './asset_middleware';
import { MiddlewareFunc, IMiddleware } from './types';

export interface IListenerOpts {
}

export class Listener {
  private opts: IListenerOpts;

  private middleware: (MiddlewareFunc | IMiddleware)[];

  public constructor(opts: IListenerOpts = {}) {
    this.opts = opts;
    this.middleware = [
      new AssetMiddleware()
    ];
  }

  public async run(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    await this.runMiddleware(req, res);

    // TODO add the router next so we can get basics going.
    if (!res.writableEnded) {
      res.end('not found\n');
    }

    return;
  }

  protected use(middleware: MiddlewareFunc | IMiddleware): this {
    if (typeof middleware === 'function' || typeof middleware.run === 'function') {
      this.middleware.push(middleware);
    } else {
      throw new Error(`use(middleware) failed because the middleware is not of type IMiddleware or MiddlewareFunc.`);
    }
    return this;
  }

  protected runMiddleware(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let next = (idx: number): Promise<void> => {
      if (idx >= this.middleware.length) {
        return;
      }

      let middleware = this.middleware[idx];
      if (typeof (<IMiddleware>middleware).run === 'function') {
        return (<IMiddleware>middleware).run(req, res, (): Promise<void> => next(idx+1));
      } else { 
        return (<MiddlewareFunc>middleware)(req, res, (): Promise<void> => next(idx+1));
      }
    }

    return next(0);
  }
}

export function createListener(opts?: IListenerOpts): http.RequestListener {
  let listener = new Listener(opts);
  return listener.run.bind(listener);
}
