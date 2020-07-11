import { IScannerOpts, Scanner, Token } from './scanner';

export class ParseError extends Error {};

function showcrlf(input: string): string {
  return input.replace('\r', '\\r').replace('\n', '\\n');
}

export class Parser<T = any> {
  scanner: Scanner;

  constructor(input: Buffer) {
    this.scanner = this.createScanner(input);
  }

  createScanner(input: Buffer): Scanner {
    return new Scanner(input, { whitespace: true });
  }

  match(expected: string): Token {
    let token = this.scanner.scan();
    if (!token.equals(expected)) {
      let pos = token.getLineAndColumn();
      throw new ParseError(`Expected "${showcrlf(expected)}" but got "${showcrlf(token.value.toString())}" at ${pos.line}:${pos.column}`);
    }
    return token;
  }

  isEof(): boolean {
    return this.scanner.isEof();
  }

  scan(): Token {
    return this.scanner.scan();
  }

  skipWs() {
    this.scanner.skipWs();
  }

  peek(): Token {
    return this.scanner.peek();
  }

  parse(): T {
    throw new Error('not implemented');
  }
}
