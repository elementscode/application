import * as fs from 'fs';
import { ServerRequest } from './server-request';
import { ParamsObject } from './params-object';
import { ParseError } from './parser';
import { File } from './file';
import { MultipartForm, parseHeaderValueFields } from './multipart-form';
import {
  NotAcceptableError
} from './errors';

let reIsNumber = /[0-9]+(\.[0-9]+)?/

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
      let disposition = part.headers.get('content-disposition');
      let contentType = part.headers.get('content-type');
      let dispositionFields = parseHeaderValueFields(part.headers.get('content-disposition'));
      if (dispositionFields.has('filename')) {
        let file = new File(dispositionFields.get('filename'));
        file.body = part.body;
        file.size = part.body.length;
        file.type = contentType || 'application/octet-stream';
        req.params.set(dispositionFields.get('name'), file);
      } else {
        if (contentType == 'text/plain' || contentType == '') {
          let value: string | number = part.body.toString();
          if (reIsNumber.test(value)) {
            value = Number.parseFloat(value);
          }
          req.params.set(dispositionFields.get('name'), value);
        } else {
          req.params.set(dispositionFields.get('name'), part.body);
        }
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
