import { ServerRequest } from './server-request';
import { ParamsObject } from './params-object';

export class BodyMiddleware {
  constructor() {
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    switch (req.header('content-type')) {
      case 'application/json':
        return parseJsonBody(req, next);

      case 'multipart/form-data':
        return parseMultipartFormDataBody(req, next);

      case 'application/x-www-form-urlencoded':
        return parseFormUrlEncodedBody(req, next);

      default:
        return next();
    }
  }
}

async function parseJsonBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.body = new ParamsObject(JSON.parse(await read(req)));
    return next();
  } catch (err) {
    req.status(406);
    req.write(err + '\n');
    req.end();
  }
}

async function parseMultipartFormDataBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  next();
}

async function parseFormUrlEncodedBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  next();
}

async function read(req: ServerRequest): Promise<string> {
  return new Promise(function(accept, reject) {
    let buffer: string[] = [];
    req.req.on('data', (chunk) => buffer.push(chunk.toString()));
    req.req.on('end', () => accept(buffer.join('')));
    req.req.on('error', (err) => reject(err));
  });
}
