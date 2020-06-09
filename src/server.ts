import * as fs from 'fs';
import * as http from 'http';
import { IDistJson } from '@elements/runtime';
import { AssetMiddleware } from './asset_middleware';
import { MiddlewareFunc, IMiddleware, IMetaTag } from './types';
import { Page } from './page';

export type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export interface IServerOpts {
  run?: RequestHandler;
}

declare module 'http' {
  export interface ServerResponse {
    title(value: string);
    description(value: string);
    meta(value: IMetaTag);
    render(view: string, data?: any);
  }
}

export class Server {
  private _opts: IServerOpts;
  private _middleware: (MiddlewareFunc | IMiddleware)[];
  private _distJson: IDistJson;

  public constructor(opts: IServerOpts = {}) {
    this._opts = opts;
    this._middleware = [
      new AssetMiddleware()
    ];
    this._distJson = this.readDistJson();
  }

  public async run(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    await this.runMiddleware(req, res);

    let page = new Page({
      res: res,
      distJson: this._distJson,
    });

    res.title = page.title.bind(page);
    res.description = page.description.bind(page);
    res.meta = page.meta.bind(page);
    res.render = page.render.bind(page);

    if (this._opts.run) {
      await this._opts.run(req, res);
    }

    if (!res.writableEnded) {
      res.end('not found\n');
    }

    return;
  }

  protected use(middleware: MiddlewareFunc | IMiddleware): this {
    if (typeof middleware === 'function' || typeof middleware.run === 'function') {
      this._middleware.push(middleware);
    } else {
      throw new Error(`use(middleware) failed because the middleware is not of type IMiddleware or MiddlewareFunc.`);
    }
    return this;
  }

  protected runMiddleware(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let next = (idx: number): Promise<void> => {
      if (idx >= this._middleware.length) {
        return;
      }

      let middleware = this._middleware[idx];
      if (typeof (<IMiddleware>middleware).run === 'function') {
        return (<IMiddleware>middleware).run(req, res, (): Promise<void> => next(idx+1));
      } else { 
        return (<MiddlewareFunc>middleware)(req, res, (): Promise<void> => next(idx+1));
      }
    }

    return next(0);
  }

  protected readDistJson(): IDistJson {
    return JSON.parse(fs.readFileSync('dist.json', 'utf8'));
  }
}

export function listener(opts?: IServerOpts): http.RequestListener {
  let server = new Server(opts);
  return server.run.bind(server);
}
