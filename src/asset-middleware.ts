import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime';
import { IDistJson, IDistJsonFile, IDistJsonTarget } from '@elements/runtime';
import { ServerRequest } from './server-request';
import { debug } from './utils';
import {
  IRequest,
} from './types';

export interface IAssetMiddlewareOpts {
  distJson: IDistJson;
}

// 6 months asset expiry
const maxAssetAgeInSeconds = 24 * 60 * 60 * 30 * 6

// pull the target name out of the url path
const reTargetFromPath = /^targets\/(\w+)/;

export class AssetMiddleware {
  distJson: IDistJson;

  assetUrl: string;

  constructor(opts: IAssetMiddlewareOpts) {
    this.distJson = opts.distJson;

    if (typeof this.distJson !== 'object') {
      throw new Error(`AssetMiddleware requires the 'distJson' option but got '${typeof this.distJson}' instead.`);
    }

    this.assetUrl = this.distJson.assetUrl || '/assets';
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    if (!this.isAssetRequest(req)) {
      return next();
    }

    let filePath = req.url.replace(this.assetUrl + '/', '');
    let match: any[] = filePath.match(reTargetFromPath);
    let target: string;
    let distJsonFile: IDistJsonFile;
    let etag: string

    if (!match) {
      debug('target regex no match');
      req.status(404);
      req.end();
      return
    } else {
      target = match[1];
    }

    if (!this.distJson.targets[target]) {
      debug('target %s not in dist.json', target);
      req.status(404);
      req.end();
      return;
    }

    distJsonFile = this.distJson.targets[target].files[filePath];
    if (!distJsonFile) {
      debug('dist.json target %s no file %s', target, filePath);
      req.status(404);
      req.end();
      return;
    }

    etag = req.header('If-None-Match') as string;
    if (etag && etag == distJsonFile.version) {
      req.status(304);
      req.end();
      return;
    }

    req.status(200);
    req.header('Content-Type', mime.getType(filePath));
    req.header('ETag', distJsonFile.version);
    req.header('Cache-Control', `max-age=${maxAssetAgeInSeconds}`);

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

  isAssetRequest(req: ServerRequest): boolean {
    return (req.method == 'GET' || req.method == 'HEAD') && req.url.startsWith(this.assetUrl);
  }
}
