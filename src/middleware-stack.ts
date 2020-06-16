import { ServerRequest } from './server-request';
import { debug } from './debug';
import {
  IMiddleware,
} from './types';

export class MiddlewareStack {
  _middleware: ((req: ServerRequest) => Promise<void>)[];

  constructor() {
    this.clear();
  }

  clear(): this {
    this._middleware = [];
    return this;
  }

  add(middleware: IMiddleware): this {
    let idx: number = this._middleware.length;

    let callback = async (req: ServerRequest) => {
      return await middleware.run(req, async () => {
        let nextIdx: number = idx + 1;
        if (nextIdx >= this._middleware.length) {
          return;
        } else {
          await this._middleware[nextIdx](req);
        }
      });
    }

    this._middleware.push(callback);
    return this;
  }

  async run(req: ServerRequest): Promise<void> {
    if (this._middleware.length > 0) {
      return this._middleware[0](req);
    }
  }
}
