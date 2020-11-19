import * as fs from 'fs';
import * as url from 'url';
import * as path from 'path';
import * as mime from 'mime';
import { IDistJson, IDistJsonFile, IDistJsonTarget } from '@elements/runtime';
import { ServerRequest } from './server-request';
import { debug } from './debug';
import {
  IRequest,
} from './types';

export interface IAssetMiddlewareOpts {
  distJson: IDistJson;
}

// 6 months asset expiry
const maxAssetAgeInSeconds = 24 * 60 * 60 * 30 * 6

export interface IUrlAssetInfo {
  target: string;
  url: string;
  path: string;
}

export class AssetMiddleware {
  distJson: IDistJson;
  reUrlPrefix: RegExp;
  urlAssetInfo: Map<string, IUrlAssetInfo>;

  constructor(opts: IAssetMiddlewareOpts) {
    this.distJson = opts.distJson;

    if (typeof this.distJson !== 'object') {
      throw new Error(`AssetMiddleware requires the 'distJson' option but got '${typeof this.distJson}' instead.`);
    }

    this.urlAssetInfo = new Map();

    let urlPrefixes: string[] = [];
    for (let [targetName, target] of Object.entries(this.distJson.targets)) {
      if (target.url) {
        let urlPath: string = url.parse(target.url).pathname;
        urlPrefixes.push(urlPath);
        this.urlAssetInfo.set(urlPath, {
          target: targetName,
          url: urlPath,
          path: target.path,
        });
      }
    }

    this.reUrlPrefix = new RegExp(`^(${urlPrefixes.join('|')})\/(\\w+)`);
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    let info: IUrlAssetInfo = this.getUrlAssetInfo(req);
    if (!info) {
      return next();
    }

    let filePath = req.url.replace(info.url, info.path).split(/[?#]/)[0];
    let target: string = info.target;
    let distJsonFile: IDistJsonFile;
    let distJsonSmFile: IDistJsonFile;
    let etag: string

    if (!this.distJson.targets[target]) {
      debug('this.distJson.targets[%j] is undefined', target);
      req.status(404);
      req.end();
      return;
    }

    distJsonFile = this.distJson.targets[target].files[filePath];
    if (!distJsonFile) {
      debug('this.distJson.targets[%j].files[%j] is undefined', target, filePath);
      req.status(404);
      req.end();
      return;
    }

    req.header('Content-Type', mime.getType(filePath));
    req.header('Cache-Control', `max-age=${maxAssetAgeInSeconds}`);
    req.header('ETag', distJsonFile.version);

    distJsonSmFile = this.distJson.targets[target].files[filePath+'.map'];
    if (distJsonSmFile) {
      let sourceMapUrl = filePath.replace(info.path, info.url) + '.map?version=' + distJsonSmFile.version;
      req.header('X-SourceMap', sourceMapUrl);
    }

    etag = req.header('If-None-Match') as string;
    if (etag && etag == distJsonFile.version) {
      req.status(304);
      req.end();
      return;
    }

    req.status(200);

    if (req.method == 'HEAD') {
      req.end();
      return;
    }

    if (this.shouldServeGzippedAsset(req, filePath, target)) {
      let gzippedAssetFile = this.distJson.targets[target].files[filePath + '.gz'];
      req.header('Content-Encoding', 'gzip');
      let bytes = fs.readFileSync(filePath + '.gz', { encoding: null });
      req.write(bytes);
      req.end();
      return;
    } else {
      let bytes = fs.readFileSync(filePath, { encoding: null });
      req.write(bytes);
      return;
    }
  }

  shouldServeGzippedAsset(req: ServerRequest, filePath: string, target: string): boolean {
    let acceptEncoding: string = req.header('Accept-Encoding') as string;

    if (acceptEncoding && /gzip/.test(acceptEncoding)) {
      let distJsonTarget: IDistJsonTarget = this.distJson.targets[target];

      if (!distJsonTarget) {
        return false;
      }

      if (distJsonTarget.files[filePath + '.gz']) {
        return true;
      }
    }

    return false;
  }

  getUrlAssetInfo(req: ServerRequest): IUrlAssetInfo | undefined {
    if (req.method != 'GET' && req.method != 'HEAD') {
      return undefined;
    }

    let match = req.url.match(this.reUrlPrefix);

    if (!match) {
      return undefined;
    }

    let urlPrefix = match[1];
    if (urlPrefix) {
      let info = this.urlAssetInfo.get(urlPrefix);
      return info;
    } else {
      return undefined;
    }
  }
}
