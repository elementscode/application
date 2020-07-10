import { ServerRequest } from './server-request';
import { ParamsObject } from './params-object';
import {
  NotAcceptableError
} from './errors';

export class BodyMiddleware {
  constructor() {
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    let contentType: string = req.header('content-type') as string;

    if (/application\/json/.test(contentType)) {
      return parseJsonBody(req, next);
    } else if (/multipart\/form-data/.test(contentType)) {
      return parseMultipartFormDataBody(req, next);
    } else if (/application\/x-www-form-urlencoded/.test(contentType)) {
      return parseFormUrlEncodedBody(req, next);
    } else if (/text\/plain/.test(contentType)) {
      return parsePlainTextBody(req, next);
    }

    return next();
  }
}

async function parseJsonBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.body = new ParamsObject(JSON.parse(await read(req)));
    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

const reMultiPartBoundary = /boundary=(--[^\n\s]+)/

async function parseMultipartFormDataBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    let boundary = getContentTypeBoundaryOrThrow(req);


    req.body = new ParamsObject({
      value: await read(req)
    });

    console.log(req.body.get('value'));

    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

async function parseFormUrlEncodedBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.body = new ParamsObject({
      value: await read(req)
    });

    console.log(req.body.get('value'));

    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

async function parsePlainTextBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.body = new ParamsObject({
      value: await read(req)
    });

    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

async function read(req: ServerRequest): Promise<string> {
  return new Promise(function(accept, reject) {
    let buffer: string[] = [];
    req.req.on('data', (chunk) => buffer.push(chunk.toString()));
    req.req.on('end', () => accept(buffer.join('')));
    req.req.on('error', (err) => reject(err));
  });
}

function getContentTypeBoundaryOrThrow(req: ServerRequest): string {
  let contentType = req.header('content-type') as string;
  let boundaryMatch = reMultiPartBoundary.exec(contentType);
  if (!boundaryMatch) {
    throw new Error('missing boundary in Content-Type header.');
  }
  let boundary = boundaryMatch[1];
  return boundary;
}

