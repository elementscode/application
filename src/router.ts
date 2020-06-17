import { Route, RouteHandler } from './route';
import {
  IRequest,
  IRoute
} from './types';

export interface IRouterOpts {
  prefix?: string;
}

export class Router implements IRoute {
  prefix?: string;
  _routes: IRoute[];

  /**
   * Constructs a new Router.
   */
  public constructor() {
    this._routes = [];
  }

  /**
   * The number of routes.
   */
  public get size() {
    return this._routes.length;
  }

  /**
   * The number of routes.
   */
  public get length() {
    return this.size;
  }

  /**
   * Adds a new route.
   *
   * @param method - The http method.
   * @param path - The url path for the route.
   * @param handler - The handler function to be called for urls
   * matching this route.
   */
  public route(method: string, path: string, handler: RouteHandler): this {
    let route = new Route(method, path, handler);
    this._routes.push(route);
    return this;
  }

  /**
   * Creates a GET route for a page in the app.
   *
   * @param path - The url for the page.
   * @param handler - The function handler for the page.
   */
  public page(path: string, handler: RouteHandler): this {
    this.route('get', path, handler);
    return this;
  }

  /**
   * Import another router, optionally at a prefix url.
   *
   */
  public routes(prefix: string, router?: IRoute|{default: IRoute}): this {
    if (typeof router === 'undefined') {
      // it might be undefined because it's a server only route.
      return this;
    }

    if (typeof (<{default: IRoute}>router).default !== 'undefined') {
      // automatically assign the default export if there is one.
      router = (<{default: IRoute}>router).default;
    }

    let iroute = router as IRoute;
    iroute.prefix = prefix || '';
    this._routes.push(iroute);
    return this;
  }

  /**
   * Delete a route. Returns true if the route was deleted, or false if it
   * wasn't found.
   *
   * @param route - The route to delete. You can obtain this from the return
   * value of the route(...) method.
   */
  public delete(route: Route): boolean {
    let idx = this._routes.indexOf(route);

    // found the route so delete it
    if (idx >= 0) {
      // delete the route from the routes array.
      this._routes.splice(idx, 1);
      return true;
    }

    // the route wasn't found
    else {
      return false;
    }
  }

  /**
   * Returns true if the urlPath has this router's url prefix.
   */
  public test(urlPath: string, req: IRequest): boolean {
    if (typeof this.prefix === 'string') {
      if (urlPath.startsWith(this.prefix)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find the route for the given request and call its handler function. If the
   * route was successfully found and run returns true, otherwise returns false.
   */
  public async run(urlPath: string, req: IRequest): Promise<boolean> {
    if (typeof this.prefix === 'string') {
      urlPath = urlPath.replace(this.prefix, '');
    }

    for (let idx = 0; idx < this._routes.length; idx++) {
      let route = this._routes[idx];

      if (route.test(urlPath, req)) {
        return await this._routes[idx].run(urlPath, req);
      }
    }

    return false;
  }
}
