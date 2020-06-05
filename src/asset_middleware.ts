import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as mime from 'mime';
import { URL } from 'url';
import { IDistJson, IDistJsonFile, IDistJsonTarget } from '@elements/runtime';

// 6 months asset expiry
const maxAssetAgeInSeconds = 24 * 60 * 60 * 30 * 6

export interface IAssetMiddlewareOpts {
}

export class AssetMiddleware {
  private opts: IAssetMiddlewareOpts;
  private distJson: IDistJson;

  public constructor(opts: IAssetMiddlewareOpts = {}) {
    this.opts = opts;
    this.load();
  }

  public async run(req: http.IncomingMessage, res: http.ServerResponse, next: () => Promise<void>): Promise<void> {
    if (!this.isAssetRequest(req)) {
      return next();
    }

    let url: string = req.url.split(/#|\?/)[0];
    let assetFilePath: string = url.replace(this.distJson.assetUrl, this.distJson.assetPath).replace('/', path.sep);
    let reAssetTarget: RegExp = new RegExp(`^${this.distJson.assetPath}${path.sep}(\\w+)`);
    let match: any[] = assetFilePath.match(reAssetTarget);
    let target: string;

    if (!match) {
      res.statusCode = 404;
      res.end();
      return;
    } else {
      target = match[1];
    }

    if (!this.distJson.targets[target]) {
      res.statusCode = 404;
      res.end();
      return;
    }

    let distJsonFile: IDistJsonFile = this.distJson.targets[target].files[assetFilePath];
    if (!distJsonFile) {
      res.statusCode = 404;
      res.end();
      return;
    }

    let etag: string = req.headers['if-none-match'] as string;
    if (etag && etag == distJsonFile.version) {
      res.statusCode = 304;
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mime.getType(assetFilePath));
    res.setHeader('ETag', distJsonFile.version);
    res.setHeader('Cache-Control', `max-age=${maxAssetAgeInSeconds}`);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    if (this.shouldServeGzippedAsset(req, assetFilePath, target)) {
      let gzippedAssetFile = this.distJson.targets[target].files[assetFilePath + '.gz'];
      res.setHeader('Content-Encoding', 'gzip');
      let bytes = fs.readFileSync(assetFilePath + '.gz', { encoding: null });
      res.write(bytes);
      res.end();
      return;
    } else {
      let bytes = fs.readFileSync(assetFilePath, { encoding: null });
      res.write(bytes);
      res.end();
      return;
    }
  }

  public load() {
    this.distJson = JSON.parse(fs.readFileSync('dist.json', 'utf8'))
  }

  protected isAssetRequest(req: http.IncomingMessage): boolean {
    return (req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith(this.distJson.assetUrl);
  }

  protected shouldServeGzippedAsset(req: http.IncomingMessage, assetFilePath: string, target: string): boolean {
    let acceptEncoding: string = req.headers['accept-encoding'] as string;

    if (acceptEncoding && /gzip/.test(acceptEncoding)) {
      let distJsonTarget: IDistJsonTarget = this.distJson.targets[target];

      if (!distJsonTarget) {
        return false;
      }

      if (distJsonTarget.files[assetFilePath + '.gz']) {
        return true;
      }
    }

    return false;
  }
}
