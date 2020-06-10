import { RouteHandler } from './route';
import { Router } from './router';
import {
  IRequest,
  IRoute,
  IMetaTag,
  ErrorCallback,
} from './types';

export class Application implements IRoute {
  private _title: string;
  private _description: string;
  private _meta: {[index: string]: IMetaTag};
  private _router: Router;
  private _onUnhandledErrorCb: ErrorCallback;
  private _onNotFoundErrorCb: ErrorCallback;
  private _onNotAuthorizedErrorCb: ErrorCallback;
  public prefix?: string;

  public constructor() {
    this._router = new Router();
    this._meta = {};
    this._title = '';
    this._description = '';
  }

  public title(value?: string): string {
    if (arguments.length == 1) {
      this._title = value;
    }

    return this._title;
  }

  public description(value?: string): string {
    if (arguments.length == 1) {
      this._description = value;
    }

    return this._description;
  }

  public meta(value: IMetaTag): this {
    if (value.name) {
      this._meta[value.name] = value;
    } else if (value.httpEquiv) {
      this._meta[value.httpEquiv] = value;
    } else {
      throw new Error('The meta object must have either a name or httpEquiv property.');
    }

    return this;
  }

  public getMeta(): {[index: string]: IMetaTag} {
    return this._meta;
  }

  /**
   * Returns true if the urlPath has this app's url prefix.
   */
  public test(urlPath: string, req: IRequest): boolean {
    if (typeof this.prefix === 'string') {
      if (urlPath.startsWith(this.prefix)) {
        return true;
      }
    }

    return false;
  }

  public async run(urlPath: string, request: IRequest): Promise<boolean> {
    let wasFound = await this._router.run(urlPath, request);
    return wasFound
  }

  public page(path: string, handler: RouteHandler): this {
    this._router.page(path, handler);
    return this;
  }

  /**
   * Import another router, optionally at a prefix url.
   *
   */
  public routes(router: IRoute, prefix?: string): this {
    if (typeof router === 'undefined') {
      throw new Error('app.routes(router, prefix) received an undefined router. Is the router or app exported from the imported file?');
    }
    this._router.routes(router, prefix);
    return this;
  }

  /**
   * The provided callback will be called for unhandled errors.
   */
  public onUnhandledError(callback: ErrorCallback): this {
    this._onUnhandledErrorCb = callback;
    return this;
  }

  /**
   * The provided callback will be called when a route is not found for a
   * request.
   */
  public onNotFoundError(callback: ErrorCallback): this {
    this._onNotFoundErrorCb = callback;
    return this;
  }

  /**
   * The provided callback will be called when a request is not authorized.
   */
  public onNotAuthorizedError(callback: ErrorCallback): this {
    this._onNotAuthorizedErrorCb = callback;
    return this;
  }
}
