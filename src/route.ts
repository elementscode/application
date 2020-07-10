import { pathToRegexp, Key } from 'path-to-regexp';
import { SuperObject } from '@elements/utils';

import {
  IRequest,
  IRoute,
} from './types';

/**
 * The type signature for a route handler callback.
 */
export type RouteHandler = (this: IRequest, req?: IRequest) => Promise<void>;

/**
 * A single route in a set of routes in the router.
 */
export class Route implements IRoute {
  protected method: string;

  protected url: string;

  protected handler: RouteHandler;

  protected keys: Key[];

  protected regex: RegExp;

  /**
   * Constructs a new route.
   *
   * @param method - The http method.
   * @param url - The url path for the route.
   * @param handler - The handler callback.
   */
  public constructor(method: string, url: string, handler: RouteHandler) {
    this.method = method.toUpperCase();
    this.url = url;
    this.handler = handler;
    this.keys = [];
    this.regex = pathToRegexp(this.url, this.keys);
  }

  /**
   * Returns true if the given method and path match this route.
   *
   * @param method - The HTTP method (e.g. GET, POST).
   * @param url - The requested url path.
   */
  public test(urlPath: string, req: IRequest): boolean {
    // match for a given http method or HEAD and the path.
    return (req.method === 'HEAD' || this.method === req.method) && this.regex.test(urlPath);
  }

  /**
   * Runs the handler for the route given some path with parameters.
   *
   * @param thisArg - The thisArg to call the handler with.
   * @param parsedUrl - A url that has been parsed into its parts using
   * parseUrl.
   */
  public async run(urlPath: string, req: IRequest): Promise<boolean> {
    let match = this.regex.exec(urlPath);

    if (!match) {
      throw new Error(`Unable to retrieve params from parsedUrl.pathname.`);
    }

    // match is an array-like object and the first item in the array will be the
    // full path. every item after that will be the params, in the same order as
    // this.keys.
    let paramValues: any[] = match.slice(1);

    req.params = new SuperObject();
    this.keys.forEach((key, idx) => {
      req.params.set(key.name as string, paramValues[idx]);
    });
    await this.handler.call(req, req);
    return true;
  }
}
