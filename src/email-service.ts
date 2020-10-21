import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { IDistJson, IDistJsonBundle, IDistJsonBundleFile } from '@elements/runtime';
import { Config, findOrCreateAppConfig } from '@elements/config';
import {
  indent,
  capitalize,
  diskPath,
} from '@elements/utils';
import { Email } from './email';
import { debug } from './debug';

const defaultEmailHtmlTemplate = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    {{style}}
  </head>

  <body>
    {{body}}
  </body>
</html>
`;

const reIsDevEnv = /^dev/

export interface IEmailServiceOpts {
  env: string;
}

class EmailService {
  private opts: IEmailServiceOpts;
  private htmlTemplate: string;
  private distJson: IDistJson;

  public configure(opts: IEmailServiceOpts): this {
    this.opts = opts;
    return this;
  }

  public load(): this {
    this.loadHtmlTemplate();
    this.readDistJson();
    return this;
  }

  public async send(email: Email) {
    let config = findOrCreateAppConfig();
    let local = reIsDevEnv.test(this.opts.env) || !config.get('smtp');
    let transport = this.createTransport(local, config);
    let text = '';
    let html = '';

    let info = await transport.sendEmail({
      from: email.getFrom(),
      to: email.getTo(),
      cc: email.getCc(),
      bcc: email.getBcc(),
      subject: email.getSubject(),
      text: text,
      html: html,
    });

    if (local) {
      console.log(info.messageId);
      info.message.pipe(process.stdout);
    }
  }

  protected loadHtmlTemplate(): void {
    try {
      // try using config/email.html first
      let filePath = path.join(process.cwd(), 'config', 'email.html');
      this.htmlTemplate = fs.readFileSync(filePath, 'utf8');
    } catch(err) {
      // if it doesn't exist then use the default
      this.htmlTemplate = defaultEmailHtmlTemplate;
    }
  }

  protected readDistJson() {
    debug('email service read build.json')
    let distJsonFilePath = path.join(process.cwd(), 'dist.json');
    this.distJson = JSON.parse(fs.readFileSync(distJsonFilePath, 'utf8'));
  }

  protected createTransport(local: boolean, config: Config): any {
    let transport;

    if (local) {
      transport = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
      });
    } else {
      transport = nodemailer.createTransport({
        host: config.getOrThrow('smtp.host'),
        port: config.get('smtp.port', 465),
        secure: true,
        auth: {
          user: config.getOrThrow('smtp.user'),
          port: config.getOrThrow('smtp.password'),
        }
      });
    }

    return transport;
  }

  protected getHtml<T = any>(key: string, data: T = {} as any): string {
    let distRelPath: string = this.distJson.targets['main'].sources[key];
    if (!distRelPath) {
      throw new Error(`${key} not found in dist.json`);
    }

    let distJsonFile = this.distJson.targets['main'].files[distRelPath];
    let bundle = this.distJson.targets['browser'].bundles[distJsonFile.source];

    let viewFilePath = path.join(process.cwd(), distRelPath);
    let exports = require(viewFilePath);
    let view = exports.default;
    let el = React.createElement(view, data);
    let body = ReactDOMServer.renderToString(el);

    let html: string = this.htmlTemplate;
    html = html.replace('{{style}}', this.getStyleHtml(bundle));
    html = html.replace('{{body}}', indent(body, 4, true));
    return html;
  }

  protected getStyleHtml(bundle: IDistJsonBundle): string {
    let styleText = bundle.style.map(file => fs.readFileSync(file.path, 'utf8')).join('\n\n');
    return '<style>\n' + indent(styleText, 4, true) + '\n</style>\n';
  }

  protected getTextFromHtml(html: string): string {
    return html;
  }
}

interface ISMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export let emailService = new EmailService();
