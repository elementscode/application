import * as http from 'http';
import * as ParsedUrl from 'url-parse';
import { ParamsObject } from './params-object';
import { IDistJsonBundle } from '@elements/runtime';
import { Session } from './session';
import { ServerRequest } from './server-request';

export type MiddlewareFunc = (req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>) => Promise<void>;

export interface IMiddleware {
  run(req: ServerRequest, next: () => Promise<void>): Promise<void>;
}

export interface IHeaderMap {
  [index: string]: string;
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

export type ErrorCallback = (req: IRequest, err: Error) => any;

export interface IRequest {
  req?: http.IncomingMessage;
  res?: http.ServerResponse;
  session: Session;
  title(value?: string): string;
  description(value?: string): string;
  meta(value?: IMetaTag);
  parsedUrl: ParsedUrl;
  url: string;
  params: ParamsObject;
  query: {[key: string]: any};
  hash: string;
  method: string;
  go(url: string, opts?: any);
  call<T = any>(method: string, ...args: any[]): Promise<T>;
  render<T = any>(importPath: string, data?: T): Promise<void>;
  status(value?: number): number;
  header(key: string | IHeaderMap, value?: HeaderValue): HeaderValue;
  write(content: any, encoding?: BufferEncoding): boolean;
  json(value: any): boolean;
  end(): void;
  log(msg: string, ...args: any[]): void;
}

export interface ISessionOptions {
  key?: string;
  password?: string;
  loggedInExpires?: number;
  loggedOutExpires?: number;
}

export interface IGoOpts {
  replace?: boolean;
}

export interface IMessage {
  type: string;
  cookie?: string;
}

export interface IClientMessage extends IMessage {
  csrf: string;
}

export interface IRestartMessage extends IMessage {
  type: 'restart';
  bundles: {
    [index: string]: IDistJsonBundle;
  }
}

export interface ICallMessage extends IClientMessage {
  type: 'call';
  id: number;
  method: string;
  args: any[];
}

export interface IReturnMessage extends IMessage {
  type: 'return';
  id: number;
  value: any;
}

export interface IErrorMessage extends IMessage {
  type: 'error';
  id?: number;
  value: any;
}

export interface ILoader {
  load(key: string, onLoad?: () => any, onError?: (err: Error) => any);
}

export interface ISessionHost {
  session: Session;
}

export interface IHttpListenOptions {
  port?: number;
  host?: string;
  backlog?: number;
  path?: string;
  exclusive?: boolean;
  readableAll?: boolean;
  writableAll?: boolean;
  ipv6Only?: boolean;
}
