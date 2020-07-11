import * as fs from 'fs';
import { ServerRequest } from './server-request';
import { ParamsObject } from './params-object';
import { ParseError } from './parser';
import { MultipartForm, parseHeaderValueFields } from './multipart-form';
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
    let jsonValue = JSON.parse((await req.read()).toString());
    Object.assign(req.params, jsonValue);
    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

async function parseMultipartFormDataBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    let form = await MultipartForm.parse(req);

    for (let part of form.parts) {
      console.log(part);
      let disposition = part.headers.get('content-disposition');
      let fields = parseHeaderValueFields(part.headers.get('content-disposition'));
      if (fields.has('filename')) {
        fs.writeFileSync('./out', part.body);
        console.log('file: %s, size: %d', fields.get('filename'), part.body.length);
      }
    }

    return next();
  } catch (err) {
    if (err instanceof ParseError) {
      throw new NotAcceptableError(err.message);
    } else {
      throw err;
    }
  }
}

async function parseFormUrlEncodedBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.params.set('body', await req.read());
    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}

async function parsePlainTextBody(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  try {
    req.params.set('body', await req.read());
    return next();
  } catch (err) {
    throw new NotAcceptableError(err.message);
  }
}
