import * as http from 'http';

export type MiddlewareFunc = (req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>) => Promise<void>;

export interface IMiddleware {
  run(req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>): Promise<void>;
}

export interface IMetaTag {
  name?: string;
  httpEquiv?: string;
  content: string;
}

export interface IPageApi {
  render(view: string);
}

class Response extends http.ServerResponse {
  public render(view: string, data: any): void {
  }
}

export type PageCallback = (this: IPageApi, req: http.IncomingMessage, res: Response) => Promise<void>;
