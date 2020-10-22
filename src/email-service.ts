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
import { Logger } from './logger';
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
  private loaded: boolean;
  private logger: Logger;

  public configure(opts: IEmailServiceOpts): this {
    this.opts = opts;
    return this;
  }

  public load(): this {
    this.loadHtmlTemplate();
    this.readDistJson();
    this.loaded = true;
    this.logger = new Logger();
    this.logger.tag('email', 104);
    return this;
  }

  public async send(email: Email): Promise<void> {
    if (!this.loaded) {
      this.load();
    }

    let config = findOrCreateAppConfig();
    let defaultFromAddr = config.get('email.from');
    if (!email['_from'] && typeof defaultFromAddr === 'string') {
      email.from(defaultFromAddr);
    }

    this.validate(email);

    let html = this.getHtml(email['_renderImportPath'], email['_renderData']);

    let transport = this.createTransport(config);
    let info = await transport.sendMail({
      from: email['_from'],
      to: email['_to'].join(', '),
      cc: email['_cc'].join(', '),
      bcc: email['_bcc'].join(', '),
      subject: email['_subject'],
      html: html,
    });

    if (config.equals('email.live', false)) {
      this.logger.log('\n' + 'Email (local):\n' + indent(`id: ${info.messageId}`, 2) + '\n' + indent(email.toString(), 2));
    } else {
      this.logger.log('\n' + 'Email (live):\n' + indent(`id: ${info.messageId}`, 2) + '\n' + indent(email.toString(), 2));
    }
  }

  protected validate(email: Email) {
    let fromAddr = email['_from'];
    let toAddr = email['_to'].join(', ');
    let renderImportPath = email['_renderImportPath'];
    let missing = [];

    if (!fromAddr) {
      missing.push('from');
    }
    if (!toAddr) {
      missing.push('to');
    }

    if (!renderImportPath) {
      missing.push('render');
    }

    if (missing.length > 0) {
      throw new Error(`The email is missing the following method calls: ${missing.join(', ')}. Make sure to call the from, to and render methods of the email in order to send it.`);
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

  protected createTransport(config: Config): any {
    let local = config.get('email.live', false) == false;

    if (local) {
      return nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
      });
    } else {
      return nodemailer.createTransport({
        host: config.getOrThrow('email.host'),
        port: config.get('email.port', 465),
        secure: true,
        auth: {
          user: config.getOrThrow('email.user'),
          pass: config.getOrThrow('email.password'),
        }
      });
    }
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
    html = html.replace('{{style}}', indent(this.getStyleHtml(bundle), 4, true));
    html = html.replace('{{body}}', indent(body, 4, true));
    return html;
  }

  protected getStyleHtml(bundle: IDistJsonBundle): string {
    let styleText = bundle.style.map(file => fs.readFileSync(file.path, 'utf8')).join('\n\n');
    return '<style>\n' + '\n' + indent(styleText, 2, false) + '\n</style>\n';
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
