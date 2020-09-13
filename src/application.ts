import { RouteHandler } from './route';
import { Router } from './router';
import { EventSystem } from './events';
import {
  IRequest,
  IRoute,
  IMetaTag,
  ErrorCallback,
} from './types';

export type ServerAppCallback = (app: Application) => any;

export class Application implements IRoute {
  private _title: string;
  private _description: string;
  private _meta: {[index: string]: IMetaTag};
  private _router: Router;
  private _events: EventSystem;
  public prefix?: string;

  public constructor() {
    this._router = new Router();
    this._meta = {};
    this._title = '';
    this._description = '';
    this._events = new EventSystem();
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
  public routes(prefix: string, routeExports?: {default: Router}): this {
    this._router.routes(prefix, routeExports);
    return this;
  }

  /**
   * Add a route to the app.
   *
   * @param method - The http method (e.g. get, put, post).
   * @param path - The url path.
   * @param handler - The route handler function.
   */
  public route(method: string, path: string, handler: RouteHandler): this {
    this._router.route(method, path, handler);
    return this;
  }

  /**
   * Listen to an event.
   * @param event - The name of the event to listen to (e.g. 'start').
   * @param callback - The function to call when the event is fired.
   */
  public on(event: string, callback: (...args: any[]) => any): this {
    this._events.on(event, callback);
    return this;
  }

  /**
   * Fire an event with the given args.
   * @param event - The name of the event to fire.
   * @param args - The arguments to pass to the event handlers.
   */
  public fire(event: string, args: any[], thisArg: any): this {
    this._events.fire(event, args, thisArg);
    return this;
  }

  /**
   * Load server only code.
   *
   * Example:
   *   app.server(require('./server'))
   *
   */
  public server(callback: ServerAppCallback|{default: ServerAppCallback}): this {
    if (typeof callback === 'function') {
      callback.call(this, this);
    } else if (typeof callback.default === 'function') {
      callback.default.call(this, this);
    }

    return this;
  }
}
