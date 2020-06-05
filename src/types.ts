import * as http from 'http';

export type MiddlewareFunc = (req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>) => Promise<void>;

export interface IMiddleware {
  run(req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>): Promise<void>;
}
