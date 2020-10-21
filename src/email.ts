import * as nodemailer from 'nodemailer';
import { emailService } from './email-service';

export class Email {
  private _to: string[];
  private _from: string;
  private _cc: string[];
  private _bcc: string[];
  private _subject: string;
  private _renderImportPath: string;
  private _renderData: any;

  public static create(): Email {
    return new Email();
  }

  public constructor() {
    this._subject = '';
    this._to = [];
    this._from = '';
    this._cc = [];
    this._bcc = [];
  }

  public to(...addresses: string[]): this {
    this._to = addresses;
    return this;
  }

  public getTo(): string {
    return this._to.join(', ');
  }

  public from(address: string): this {
    this._from = address;
    return this;
  }

  public cc(...addresses: string[]): this {
    this._cc = addresses;
    return this;
  }

  public bcc(...addresses: string[]): this {
    this._bcc = addresses;
    return this;
  }

  public subject(value: string): this {
    this._subject = value;
    return this;
  }

  public render(importPath: string, data: any = {}): this {
    this._renderImportPath = importPath;
    this._renderData = data;
    return this;
  }

  public async send(): Promise<void> {
    return emailService.send(this);
  }

  public toString(): string {
    let lines = [];
    lines.push(`from: ${this._from}`);
    lines.push(`to: ${this._to.join(', ')}`);
    if (this._cc.length > 0) {
      lines.push(`cc: ${this._cc.join(', ')}`);
    }
    if (this._bcc.length > 0) {
      lines.push(`bcc: ${this._bcc.join(', ')}`);
    }
    lines.push(`subject: ${this._subject}`);
    lines.push(`template: ${this._renderImportPath}`);
    return lines.join('\n');
  }
}

export type EmailCallback = (this: Email) => any;
export function email(callback: EmailCallback): Email {
  let email = new Email();
  callback.call(email);
  return email;
}
