import * as fs from 'fs';
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

export class AssetMiddleware {
  distJson: IDistJson;
  assetUrl: string;
  assetPath: string;
  reTargetMatcher: RegExp;

  constructor(opts: IAssetMiddlewareOpts) {
    this.distJson = opts.distJson;

    if (typeof this.distJson !== 'object') {
      throw new Error(`AssetMiddleware requires the 'distJson' option but got '${typeof this.distJson}' instead.`);
    }

    this.assetUrl = this.distJson.assetUrl || '/assets';
    this.assetPath = this.distJson.assetPath || 'assets';
    this.reTargetMatcher = new RegExp(`^${this.assetUrl}\/(\\w+)`);
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
    if (!this.isAssetRequest(req)) {
      return next();
    }

    let filePath = req.url.replace(this.assetUrl, this.assetPath).split(/[?#]/)[0];
    let target: string = 'browser';
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
      let sourceMapUrl = filePath.replace(this.assetPath, this.assetUrl) + '.map?version=' + distJsonSmFile.version;
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

  isAssetRequest(req: ServerRequest): boolean {
    return (req.method == 'GET' || req.method == 'HEAD') && req.url.startsWith(this.assetUrl);
  }
}
