import * as http from 'http';
import * as ParsedUrl from 'url-parse';
import { Session } from './session';

export type MiddlewareFunc = (req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>) => Promise<void>;

export interface IMiddleware {
  run(req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>): Promise<void>;
}

export interface IMetaTag {
  name?: string;
  httpEquiv?: string;
  content: string;
}

export type HeaderValue = string | number | string[] | undefined;

export interface IRoute {
  prefix?: string;
  test(urlPath: string, req: IRequest): boolean;
  run(urlPath: string, req: IRequest): Promise<boolean>;
}

export interface IRequest {
  req?: http.IncomingMessage;
  res?: http.ServerResponse;

  session: Session;

  title(value?: string): string;
  description(value?: string): string;
  meta(value?: IMetaTag);

  parsedUrl: ParsedUrl;
  url: string;
  params: {[key: string]: any};
  query: {[key: string]: any};
  hash: string;
  method: string;
  go(url: string, opts?: any);
  render<T = any>(importPath: string, attrs?: T);
  status(value?: number): number;
  header(key: string | IHeaderMap, value?: HeaderValue): HeaderValue;
  write(content: any): boolean;
  end(): void;
}

export interface ISessionOptions {
  key?: string;
  password: string;
  loggedInExpires?: number;
  loggedOutExpires?: number;
}
