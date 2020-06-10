import * as path from 'path';
import * as http from 'http';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import * as ParsedUrl from 'url-parse';
import { IDistJson } from '@elements/runtime';
import {
  indent,
  capitalize,
  diskPath,
} from '@elements/utils';
import { Logger } from './logger';
import { debug } from './utils';
import { Application } from './application';
import { Session } from './session';
import { call } from './call';
import {
  IHeaderMap,
  HeaderValue,
  IRequest,
  IMetaTag,
} from './types';

let htmlTemplate = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    {title}
    {meta}
    {style}
    {code}
  </head>

  <body>
    <div id="app">{body}</div>
  </body>
</html>
`;

export interface IServerRequestOpts {
  app: Application;
  distJson: IDistJson;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  logger: Logger;
  session: Session;
}

export class ServerRequest implements IRequest {
  public req?: http.IncomingMessage;
  public res?: http.ServerResponse;
  public session: Session;
  public logger: Logger;
  public params: {[key: string]: any};
  public parsedUrl: ParsedUrl;
  
  private _app: Application;
  private _meta: {[index: string]: IMetaTag};
  private _title: string;
  private _description: string;
  private _distJson: IDistJson;

  public get url(): string {
    return this.req.url;
  }

  public get method(): string {
    return this.req.method;
  }

  public get query(): {[key: string]: any} {
    return this.parsedUrl.query;
  }

  public get hash(): string {
    return this.parsedUrl.hash;
  }

  constructor(opts: IServerRequestOpts) {
    this.req = opts.req;
    this.res = opts.res;
    this.logger = opts.logger;
    this.session = opts.session;
    this.parsedUrl = ParsedUrl(this.req.url, true /* parse query string */);
    this._app = opts.app;
    this._distJson = opts.distJson;
    this._meta = {};
    this._title = '';
    this._description = '';
  }

  async call<T = any>(method: string, ...args: any[]): Promise<T> {
    return call({
      session: this.session,
      logger: this.logger,
      method: method,
      args: args
    });
  }

  title(value?: string): string {
    if (arguments.length == 1) {
      this._title = value;
    }

    if (this._title && this._title.length > 0) {
      return this._title;
    } else {
      return this._app.title();
    }
  }

  description(value?: string): string {
    if (arguments.length == 1) {
      this._description = value;
    }

    if (this._description && this._description.length > 0) {
      return this._description;
    } else {
      return this._app.description();
    }
  }

  meta(value: IMetaTag): this {
    if (value.name) {
      this._meta[value.name] = value;
    } else if (value.httpEquiv) {
      this._meta[value.httpEquiv] = value;
    } else {
      throw new Error('The meta object must have either a name or httpEquiv property.');
    }

    return this;
  }

  getMeta(): {[index: string]: IMetaTag} {
    return Object.assign({}, this._app.getMeta(), this._meta);
  }

  go(url: string, opts?: any) {
    this.status(302);
    this.header('Location', url);
    this.end();
  }

  render<T = any>(importPath: string, attrs: T) {
    debug('render %s', importPath);
    this.header('Content-Type', 'text/html');
    this.write(this.getHtml<T>(importPath, attrs));
    this.end();
  }

  private getHtml<T = any>(vpath: string, attrs: T = {} as any): string {
    let distRelPath: string = this._distJson.targets['main'].sources[vpath];
    if (!distRelPath) {
      throw new Error(`${vpath} not found in dist.json`);
    }

    let distJsonFile = this._distJson.targets['main'].files[distRelPath];
    let pageBundle = this._distJson.targets['browser'].bundles[distJsonFile.source];
    let bootBundle = this._distJson.targets['browser'].bundles['boot'];

    let cssTags: string[];
    cssTags = bootBundle.style.map(url => `<link rel="stylesheet" href="${url}">`);
    cssTags = cssTags.concat(pageBundle.style.map(url => `<link rel="stylesheet" href="${url}">`));

    let scriptTags: string[];
    scriptTags = bootBundle.code.map(url => `<script type="text/javascript" src="${url}"></script>`)
    scriptTags = scriptTags.concat(pageBundle.code.map(url => `<script type="text/javascript" src="${url}"></script>`));

    let defaultMetaTags: IMetaTag[] = [
      { name: 'description', content: this.description() },
      { name: 'elements:view', content: vpath },
      { name: 'elements:data', content: Buffer.from(JSON.stringify(attrs)).toString('base64') }
    ];

    let metaTags: string;
    metaTags = defaultMetaTags.concat(Object.values(this.getMeta())).map(meta => {
      let key = meta.httpEquiv ? 'http-equiv' : 'name';
      let keyValue = meta.httpEquiv || meta.name;
      return `<meta ${key}="${keyValue}" content="${meta.content}">`;
    }).join('\n');

    let viewFilePath = path.join(process.cwd(), distRelPath);
    let exports = require(viewFilePath);
    let view = exports.default;
    let el = React.createElement(view, attrs);
    let body = ReactDOMServer.renderToString(el);

    let html: string = htmlTemplate;
    html = html.replace('{title}', `<title>${this.title()}</title>`);
    html = html.replace('{meta}', indent(metaTags, 4, true));

    if (cssTags.length > 0) {
      html = html.replace('{style}', indent(cssTags.join('\n'), 4, true));
    } else {
      html = html.replace('{style}', '');
    }

    if (scriptTags.length > 0) {
      html = html.replace('{code}', indent(scriptTags.join('\n'), 4, true));
    } else {
      html = html.replace('{code}', '');
    }

    html = html.replace('{body}', indent(body, 4, true));

    return html;
  }

  status(value?: number): number {
    if (typeof value !== 'undefined') {
      this.res.statusCode = value;
    }

    return this.res.statusCode;
  }

  header(key: string | IHeaderMap, value?: HeaderValue): HeaderValue {
    if (typeof key === 'string') {
      if (arguments.length == 2) {
        this.res.setHeader(capitalizeHeaderName(key), value);
        return value;
      } else {
        return this.req.headers[key.toLowerCase()];
      }
    } else if (typeof key === 'object') {
      for (let [header, value] of Object.entries(key)) {
        this.res.setHeader(header, value);
      }
    }

    return '';
  }

  write(content: string | Buffer): boolean {
    return this.res.write(content);
  }

  end() {
    this.res.end();
  }
}

function capitalizeHeaderName(name: string): string {
  return name.split('-').map(capitalize).join('-');
}
