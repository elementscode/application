export interface IScannerOpts {
  whitespace?: boolean;
}

export interface ILineAndColumn {
  line: number;
  column: number;
}

export class Token {
  scanner: Scanner;
  kind: string;
  value: Buffer | undefined;
  start: number;
  finish: number;

  constructor(scanner: Scanner, kind: string, value: Buffer | undefined, start: number, finish: number) {
    this.scanner = scanner;
    this.kind = kind;
    this.value = value;
    this.start = start;
    this.finish = finish;
  }

  isEof(): boolean {
    return this.kind === 'eof';
  }

  isWs(): boolean {
    return this.kind === 'ws';
  }

  isText(): boolean {
    return this.kind === 'text';
  }

  getLineAndColumn(): ILineAndColumn {
    return this.scanner.getLineAndColumn(this.start);
  }

  equals(value: string): boolean {
    return this.value ? this.value.toString() == value : false;
  }

  toString(enc?: BufferEncoding): string {
    return this.value ? this.value.toString(enc) : '';
  }
}

export class Scanner {
  input: Buffer;
  index: number;
  tokens: Token[];

  public constructor(input: Buffer, opts: IScannerOpts = {}) {
    this.index = 0;
    this.input = input;
    this.tokens = this.tokenize(this.input, opts);
  }

  public scan(): Token {
    return this.isEof() ? this.tokens[this.index] : this.tokens[this.index++];
  }

  public skipWs() {
    while (true) {
      if (this.isEof()) {
        break
      }

      if (!this.peek().equals(' ')) {
        this.scan();
        break
      }
    }
  }

  public peek(): Token {
    return this.tokens[this.index];
  }

  public isEof(): boolean {
    return this.tokens[this.index].kind == 'eof';
  }

  public getLineAndColumn(index: number): ILineAndColumn {
    if (index >= this.input.length) {
      throw new Error(`getLineAndCol failed because index is larger than input.`);
    }

    let result = { line: 0, column: 0 };
    let idx = 0;

    while (true) {
      let ch = String.fromCodePoint(this.input.readUInt8(idx));

      if (idx == index) {
        return result;
      } else if (ch == '\r') {
        result.line++;
        result.column = 0;
        idx++;
        ch = String.fromCodePoint(this.input.readUInt8(idx));
        if (ch == '\n') {
          idx++;
        }
      } else if (ch == '\n') {
        result.line++;
        result.column = 0;
        idx++;
      } else {
        idx++;
      }
    }
  }

  protected tokenize(input: Buffer, opts: IScannerOpts = {}): Token[] {
    let tokens: Token[] = [];
    let chCodePointsBuffer: number[] = [];
    let start = 0;
    let idx = 0;

    let pushBufferToken = () => {
      if (chCodePointsBuffer.length > 0) {
        let value = Buffer.from(new Uint8Array(chCodePointsBuffer));
        let finish = start + value.length;
        tokens.push(new Token(this, 'ident', value, start, finish));
        chCodePointsBuffer = [];
        start = finish;
        idx = start;
      }
    }
    
    let pushWsToken = (chCodePoints: number[]) => {
      let finish = start + chCodePoints.length;
      let value = Buffer.from(new Uint8Array(chCodePoints));
      tokens.push(new Token(this, 'ws', value, start, finish));
      start = finish;
      idx = start;
    }

    let pushEofToken = () => {
      tokens.push(new Token(this, 'eof', undefined, idx, idx));
    }

    while (true) {
      if (idx === input.length) {
        pushBufferToken();
        pushEofToken();
        break;
      }

      let chCodePoint = input.readUInt8(idx);
      let ch = String.fromCodePoint(chCodePoint);

      if (ch == ' ' || ch == '\n') {
        pushBufferToken();
        pushWsToken([chCodePoint]);
      } else if (ch == '\r') {
        pushBufferToken();
        let chCodePoint2 = input.readUInt8(idx + 1);
        let ch2 = String.fromCodePoint(chCodePoint2);
        pushWsToken(ch2 == '\n' ? [chCodePoint, chCodePoint2] : [chCodePoint]);
      } else {
        chCodePointsBuffer.push(chCodePoint);
        idx++;
      }
    }

    if (opts.whitespace === false) {
      tokens = tokens.filter(t => !t.equals(' '));
    }

    return tokens;
  }
}
