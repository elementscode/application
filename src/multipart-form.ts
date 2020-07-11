import { Parser, ParseError } from './parser';
import { ServerRequest } from './server-request';

export class FormPart {
  headers: Map<string, string>;
  body: Buffer;
}

export class MultipartForm {
  parts: FormPart[];

  public constructor() {
    this.parts = [];
  }

  public static async parse(req: ServerRequest): Promise<MultipartForm> {
    let boundary = parseMultipartBoundary(<string>req.header('content-type'));
    let body = await req.read();
    let parser = new MultipartParser(body, boundary);
    return parser.parse();
  }
}

// Content-Type: multipart/form-data; boundary=[^\r\n]+
export function parseMultipartBoundary(value: string) {
  let match = /boundary=([^\r\n]+)/.exec(value);
  if (!match) {
    throw new ParseError(`Invalid Content-Type multipart/form-data boundary: "${value}".`);
  }
  return match[1].trim();
}

// Content-Disposition: form-data; name="user.file"; filename="filename.txt"
export function parseHeaderValueFields(headerValue: string): Map<string, string> {
  let result = new Map();

  if (headerValue) {
    let parts = headerValue.split(';').map(p => p.trim());
    for (let idx = 1; idx < parts.length; idx++) {
      let part = parts[idx];
      let [key, value] = part.split('=');
      result.set(key, value.replace(/['"]/g, ''));
    }
  }

  return result
}

export class MultipartParser extends Parser<MultipartForm> {
  boundary: string;
  constructor(input: Buffer, boundary: string) {
    super(input);
    this.boundary = boundary;
  }

  parse(): MultipartForm {
    let result = new MultipartForm();
    while (true) {
      if (this.isEof()) {
        break;
      }

      if (this.peek().equals(this.closeDelimiter())) {
        break;
      }

      result.parts.push(this.parseFormPart());
    }
    return result;
  }

  // formPart := boundary crlf formPartHeaders crlf formPartBody
  parseFormPart(): FormPart {
    let part = new FormPart();
    if (this.peek().equals('\r\n')) {
      // note: sometimes the first open delimiter doesn't start with a crlf.
      this.match('\r\n');
    }
    this.match(this.openDelimiter());
    this.match('\r\n');
    part.headers = this.parseFormPartHeaders();
    this.match('\r\n');
    part.body = this.parseFormPartBody();
    return part;
  }

  // formPartHeaders := (formPartHeader)*
  parseFormPartHeaders(): Map<string, string> {
    let headers = new Map();
    while (true) {
      let token = this.peek();
      if (token.equals('\r\n')) {
        break;
      }
      let [key, value] = this.parseFormPartHeader();
      headers.set(key, value);
    }
    return headers;
  }

  // formPartHeader := formPartHeaderKey ':' formPartHeaderValue crlf
  parseFormPartHeader(): [string, string] {
    let key = this.parseFormPartHeaderKey();
    let value = this.parseFormPartHeaderValue();
    this.match('\r\n');
    return [key, value];
  }

  // formPartHeaderKey := ident
  parseFormPartHeaderKey(): string {
    if (this.isEof()) {
      throw new ParseError(`Expected a header but reached the end of the input instead.`);
    }
    let key = this.scan().toString();
    if (this.peek().equals(':')) {
      this.scan();
    }
    return key.replace(/:$/, '').toLowerCase();
  }

  // formPartHeaderValue := [^crlf]
  parseFormPartHeaderValue(): string {
    let buffer: string[] = [];
    while (true) {
      if (this.isEof() || this.peek().equals('\r\n')) {
        if (buffer.length == 0) {
          throw new ParseError(`Expected a header value but reached the end of the input instead.`);
        }
        break;
      }
      buffer.push(this.scan().toString());
    }
    return buffer.join('');
  }

  parseFormPartBody(): Buffer {
    let buffers: Buffer[] = [];
    while (true) {
      if (this.isEof()) {
        break;
      }

      let token = this.scan();
      if (token.equals('\r\n')) {
        if (this.peek().equals(this.openDelimiter()) || this.peek().equals(this.closeDelimiter())) {
          break;
        }
      }

      buffers.push(token.value);
    }

    return Buffer.concat(buffers);
  }

  openDelimiter(): string {
    return '--' + this.boundary;
  }

  closeDelimiter(): string {
    return '--' + this.boundary + '--';
  }
}
