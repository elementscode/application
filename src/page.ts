import * as crypto from 'crypto';
import * as path from 'path';
import * as http from 'http';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { IDistJson, IDistJsonFile, IDistJsonTarget, IDistJsonBundle } from '@elements/runtime';
import { indent } from './utils';
import { IMetaTag } from './types';

export interface IPageOpts {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  distJson: IDistJson;
}

let htmlTemplate = `
<!doctype html>
<html>
  <head>
    {title}
    <meta charset="utf-8">
    {meta}
    {style}
    {code}
  </head>

  <body>
    <div id="app">{view}</div>
  </body>
</html>
`;

export class Page {
  private _opts: IPageOpts;
  private _title: string;
  private _description: string;
  private _meta: {[key: string]: IMetaTag};

  public constructor(opts: IPageOpts) {
    this._opts = opts;
    this._title = '';
    this._description = '';
    this._meta = {};
  }

  public title(value: string) {
    this._title = value;
  }

  public description(value: string) {
    this._description = value;
  }

  public meta(value: IMetaTag) {
    if (!value) {
      return;
    }

    if (value.name) {
      this._meta[value.name] = value;
    } else if (value.httpEquiv) {
      this._meta[value.httpEquiv] = value;
    } else {
      throw new Error('The meta value must have a "name" or "httpEquiv" property.');
    }
  }

  public render(importPath: string, data: any = {}) {
    let serverETag = this.getETag(importPath, data);
    let clientETag = this._opts.req.headers['if-none-match'];

    if (clientETag == serverETag) {
      this._opts.res.statusCode = 304;
      this._opts.res.end();
      return;
    }

    this._opts.res.setHeader('ETag', serverETag);
    this._opts.res.setHeader('Content-Type', 'text/html');
    this._opts.res.write(this.getHtml(importPath, data));
    this._opts.res.end();
  }

  protected getETag(importPath: string, data: any = {}): string {
    let rootBundle: IDistJsonBundle = this._opts.distJson.targets['browser'].bundles['boot'];
    let pageBundle: IDistJsonBundle = this._opts.distJson.targets['browser'].bundles[importPath];
    let hasher = crypto.createHash('sha512');
    hasher.write(rootBundle.version);
    hasher.write(pageBundle.version);
    hasher.write(JSON.stringify(data));
    return hasher.digest('hex').slice(0, 10);
  }

  protected getHtml(importPath: string, data: any = {}): string {
    let distRelPath: string = this._opts.distJson.targets['main'].sources[importPath];
    let rootBundle: IDistJsonBundle = this._opts.distJson.targets['browser'].bundles['boot'];
    let pageBundle: IDistJsonBundle = this._opts.distJson.targets['browser'].bundles[importPath];

    if (!rootBundle) {
      throw new Error(`render page failed because the "root" bundle in dist.json was not found.`);
    }

    if (!pageBundle) {
      throw new Error(`render page failed because the page bundle "${importPath}" in dist.json was not found.`);
    }

    // style and script tags
    let styleTags: string[] = rootBundle.style.concat(pageBundle.style).map((file: IDistJsonFile) => `<link rel="stylesheet" href="${file.url}">`);
    let codeTags: string[] = rootBundle.code.concat(pageBundle.code).map((file: IDistJsonFile) => `<script type="text/javascript" src="${file.url}"></script>`);

    // meta tags
    let defaultMetaTags: IMetaTag[] = [
      { name: 'description', content: this._description },
      { name: 'elements:view', content: importPath },
      { name: 'elements:data', content: Buffer.from(JSON.stringify(data)).toString('base64') },
    ];
    let metaTags: string[] = defaultMetaTags.concat(Object.values(this.getMeta())).map(meta => {
      let key = meta.httpEquiv ? 'http-equiv' : 'name';
      let keyValue = meta.httpEquiv || meta.name;
      return `<meta ${key}="${keyValue}" content="${meta.content}">`;
    });

    // view
    let viewFilePath = path.join(process.cwd(), distRelPath);
    let exports = require(viewFilePath);
    let viewClass = exports.default;
    let el = React.createElement(viewClass, data);
    let view = ReactDOMServer.renderToString(el);

    return htmlTemplate
      .replace('{title}', `<title>${this.getTitle()}</title>`)
      .replace('{meta}', metaTags.length > 0 ? indent(metaTags.join('\n'), 4, true) : '')
      .replace('{style}', styleTags.length > 0 ? indent(styleTags.join('\n'), 4, true) : '')
      .replace('{code}', codeTags.length > 0 ? indent(codeTags.join('\n'), 4, true) : '')
      .replace('{view}', indent(view, 4, true));
  }

  protected getTitle(): string {
    return this._title;
  }

  protected getDescription(): string {
    return this._description;
  }

  protected getMeta(): {[key: string]: IMetaTag} {
    return this._meta;
  }
}
