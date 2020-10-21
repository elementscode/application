import * as nodemailer from 'nodemailer';

// TODO next up: use the email bundle key to figure out the dist.json. how to
// reload dist.json when it changes? read from disk every time? yeah that's the
// easiest actually. json parsing is fast. but what if you're sending a million
// emails? yeah fine for now.
// TODO render the react component and read the linked style files and put into
// the <style> tag of the html. ignore the boot and app bundles for emails. We
// only need to have server side rendering for them to work.
export class Email {
  private _to: string[];
  private _from: string;
  private _cc: string[];
  private _bcc: string[];
  private _subject: string;
  private _renderImportPath: string;
  private _renderData: any;

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

  public getFrom(): string {
    return this._from;
  }

  public cc(...addresses: string[]): this {
    this._cc = addresses;
    return this;
  }

  public getCc(): string {
    return this._cc.join(', ');
  }

  public bcc(...addresses: string[]): this {
    this._bcc = addresses;
    return this;
  }

  public getBcc(): string {
    return this._bcc.join(', ');
  }

  public subject(value: string): this {
    this._subject = value;
    return this;
  }

  public getSubject(): string {
    return this._subject;
  }

  public render(importPath: string, data: any = {}): this {
    this._renderImportPath = importPath;
    this._renderData = data;
    return this;
  }

  public getRenderImportPath(): string {
    return this._renderImportPath;
  }

  public getRenderData(): any {
    return this._renderData;
  }

  public async send() {
    let transport = nodemailer.createTransport({
      host: 'email-smtp.us-west-2.amazonaws.com',
      port: 465,
      secure: true,
      auth: {
        user: 'AKIAQHJFZRJCBDB2UCF5',
        pass: 'BATxSIKVmH/EfuiHCR2G9XivHEnpViXTVHvETWyh4HGA',
      }
    });

    await transport.sendMail({
      from: this._from,
      to: this._to.join(', '),
      cc: this._cc.join(', '),
      bcc: this._bcc.join(', '),
      subject: this._subject,
      text: 'hello world',
      html: '<b>hello world</b>',
    });
  }
}

export type EmailCallback = (this: Email) => any;
export function email(callback: EmailCallback): Email {
  let email = new Email();
  callback.call(email);
  return email;
}
