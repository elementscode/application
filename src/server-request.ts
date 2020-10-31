import * as path from 'path';
import * as http from 'http';
import * as crypto from 'crypto';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import * as ParsedUrl from 'url-parse';
import { IDistJson, IDistJsonBundle, IDistJsonBundleFile } from '@elements/runtime';
import { stringify } from '@elements/json';
import {
  indent,
  capitalize,
  diskPath,
} from '@elements/utils';
import { Logger } from './logger';
import { debug } from './debug';
import { Application } from './application';
import { Session } from './session';
import { findAndCallServiceFunction } from './service';
import { ParamsObject } from './params-object';
import {
  IHeaderMap,
  HeaderValue,
  IRequest,
  IMetaTag,
} from './types';

export interface IServerRequestOpts {
  app: Application;
  distJson: IDistJson;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  logger: Logger;
  session: Session;
  htmlTemplate: string;
}

export class ServerRequest implements IRequest {
  public req?: http.IncomingMessage;
  public res?: http.ServerResponse;
  public session: Session;
  public logger: Logger;
  public params: ParamsObject;
  public parsedUrl: ParsedUrl;
  
  private _htmlTemplate: string;
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

  public get hash(): string {
    return this.parsedUrl.hash;
  }

  constructor(opts: IServerRequestOpts) {
    this.req = opts.req;
    this.res = opts.res;
    this.logger = opts.logger;
    this.session = opts.session;
    this.parsedUrl = ParsedUrl(this.req.url, true /* parse query string */);
    this.params = new ParamsObject();
    for (let [key, value] of Object.entries(this.parsedUrl.query)) {
      this.params.set(key, value);
    }
    this._htmlTemplate = opts.htmlTemplate;
    this._app = opts.app;
    this._distJson = opts.distJson;
    this._meta = {};
    this._title = '';
    this._description = '';
  }

  public getSession(): Session {
    return this.session;
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public title(value?: string): string {
    if (arguments.length == 1) {
      this._title = value;
    }

    if (this._title && this._title.length > 0) {
      return this._title;
    } else {
      return this._app.title();
    }
  }

  public description(value?: string): string {
    if (arguments.length == 1) {
      this._description = value;
    }

    if (this._description && this._description.length > 0) {
      return this._description;
    } else {
      return this._app.description();
    }
  }

  public meta(value: IMetaTag): this {
    if (value.name) {
      this._meta[value.name] = value;
    } else if (value.httpEquiv) {
      this._meta[value.httpEquiv] = value;
    } else {
      throw new Error('The meta object must have either a name or httpEquiv property.');
    }

    return this;
  }

  public getMeta(): {[index: string]: IMetaTag} {
    return Object.assign({}, this._app.getMeta(), this._meta);
  }

  public go(url: string, opts?: any) {
    this.status(302);
    this.header('Location', url);
    this.end();
  }

  public async render<T = any>(importPath: string, data: T = {} as any): Promise<void> {
    debug('render %s', importPath);

    // etag caching
    let serverETag = this.getETag(importPath, data);
    let clientETag = this.header('If-None-Match');
    if (clientETag == serverETag) {
      this.status(304);
      this.end();
      return;
    }

    // render page
    this.header('ETag', serverETag);
    this.header('Content-Type', 'text/html');
    this.write(this.getHtml<T>(importPath, data));
    this.end();
  }

  protected getETag(importPath: string, data: any = {}): string {
    let bootBundle: IDistJsonBundle = this._distJson.targets['browser'].bundles['boot'];
    let appBundle: IDistJsonBundle = this._distJson.targets['browser'].bundles['app'];
    let pageBundle: IDistJsonBundle = this._distJson.targets['browser'].bundles[importPath];

    if (!bootBundle) {
      throw new Error(`boot bundle not found in dist.json`);
    }

    if (!appBundle) {
      throw new Error(`app bundle not found in dist.json`);
    }

    if (!pageBundle) {
      throw new Error(`${importPath} bundle not found in dist.json`);
    }

    let hasher = crypto.createHash('sha512');
    hasher.write(bootBundle.version);
    hasher.write(appBundle.version);
    hasher.write(pageBundle.version);
    hasher.write(this._htmlTemplate);
    hasher.write(JSON.stringify(data));
    return hasher.digest('hex').slice(0, 10);
  }

  protected getHtml<T = any>(key: string, data: T = {} as any): string {
    let distRelPath: string = this._distJson.targets['main'].sources[key];
    if (!distRelPath) {
      throw new Error(`${key} not found in dist.json`);
    }

    let distJsonFile = this._distJson.targets['main'].files[distRelPath];
    let bootBundle = this._distJson.targets['browser'].bundles['boot'];
    let appBundle = this._distJson.targets['browser'].bundles['app'];
    let pageBundle = this._distJson.targets['browser'].bundles[distJsonFile.source];
    let visited = new Set();

    let cssTags: string[] = [];
    bootBundle.style.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        cssTags.push(`<link rel="stylesheet" href="${file.url}" data-loader="ignore">`);
      }
    });

    appBundle.style.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        cssTags.push(`<link rel="stylesheet" href="${file.url}">`);
      }
    });

    pageBundle.style.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        cssTags.push(`<link rel="stylesheet" href="${file.url}">`);
      }
    });

    let scriptTags: string[] = [];
    bootBundle.code.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        scriptTags.push(`<script type="text/javascript" src="${file.url}" data-loader="ignore"></script>`);
      }
    });

    appBundle.code.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        scriptTags.push(`<script type="text/javascript" src="${file.url}"></script>`);
      }
    });

    pageBundle.code.forEach(file => {
      if (!visited.has(file.url)) {
        visited.add(file.url);
        scriptTags.push(`<script type="text/javascript" src="${file.url}"></script>`);
      }
    });

    let defaultMetaTags: IMetaTag[] = [
      { name: 'description', content: this.description() },
      { name: 'elements:bundle', content: key },
      { name: 'elements:data', content: Buffer.from(stringify(data)).toString('base64') }
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
    let el = React.createElement(view, data);
    let body = ReactDOMServer.renderToString(el);

    let html: string = this._htmlTemplate;
    html = html.replace('{{title}}', `<title>${this.title()}</title>`);
    html = html.replace('{{meta}}', indent(metaTags, 4, true));

    if (cssTags.length > 0) {
      html = html.replace('{{style}}', indent(cssTags.join('\n'), 4, true));
    } else {
      html = html.replace('{{style}}', '');
    }

    if (scriptTags.length > 0) {
      html = html.replace('{{code}}', indent(scriptTags.join('\n'), 4, true));
    } else {
      html = html.replace('{{code}}', '');
    }

    html = html.replace('{{body}}', indent(body, 4, true));

    return html;
  }

  public status(value?: number): number {
    if (typeof value !== 'undefined') {
      this.res.statusCode = value;
    }

    return this.res.statusCode;
  }

  public header(key: string | IHeaderMap, value?: HeaderValue): HeaderValue {
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

  public write(content: string | Buffer, encoding?: BufferEncoding): boolean {
    return this.res.write(content, encoding);
  }

  public json(value: any): boolean {
    this.header('content-type', 'application/json');
    return this.res.write(stringify(value) + '\n');
  }

  public end() {
    this.res.end();
  }

  public log(msg: string, ...args: any[]): void {
    this.logger.log(msg, ...args);
  }

  public async read(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let buffers: Buffer[] = [];
      this.req.on('data', chunk => buffers.push(chunk));
      this.req.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }
}

function capitalizeHeaderName(name: string): string {
  return name.split('-').map(capitalize).join('-');
}
