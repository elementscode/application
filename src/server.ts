import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import * as WebSocket from 'ws';
import { homedir } from 'os';
import { Config, findOrCreateAppConfig } from '@elements/config';
import { stringify, parse } from '@elements/json';
import {
  walkSync,
  Timer,
  withDefaultValues,
  indent,
} from '@elements/utils';
import { IDistJson, IDistJsonFileChangeSets } from '@elements/runtime';
import { color } from './ansi';
import { Logger } from './logger';
import { ServerRequest } from './server-request';
import { findAndCallServiceFunction } from './service';
import { Application } from './application';
import { AssetMiddleware } from './asset-middleware';
import { BodyMiddleware } from './body-middleware';
import { AppMiddleware } from './app-middleware';
import { MiddlewareStack } from './middleware-stack';
import { Session, extractCookie } from './session';
import {
  createSessionFromHttp,
  createSessionFromCookie,
  createCookieFromSession,
} from './server-session';
import { success } from './ansi';
import { onBeforeSendHeaders } from './headers';
import {
  StandardError,
  UnhandledError,
  NotAcceptableError,
  NotFoundError,
  NotAuthorizedError,
} from '@elements/error';
import {
  IMiddleware,
  IMessage,
  IErrorMessage,
  IRestartMessage,
  ICallMessage,
  IReturnMessage,
  ISessionHost,
  ISessionOptions,
  IHttpListenOptions,
} from './types';
import { debug } from './debug';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const methodColor = 165;
const successColor = 2;
const errColor = 1;
const warnColor = 172;
const subtleColor = 8;
const userIdColor = 3;
const httpColor = 32;
const wsColor = 68;
const defaultHtmlTemplate = `
<!doctype html>
<html>
  <head>
    {{title}}
    <meta charset="utf-8">
    {{meta}}
    {{style}}
    {{code}}
  </head>

  <body>
    <div id="app">{{body}}</div>
  </body>
</html>
`;

export class IServerOptions {
  env: string;
  app: Application;
}

export class Server {
  private app: Application;
  private distJson: IDistJson;
  private heartBeatIntervalId: NodeJS.Timer;
  private httpServer: http.Server|https.Server;
  private logger: Logger;
  private middleware: MiddlewareStack;
  private opts: IServerOptions;
  private config: Config;
  private wsServer: WebSocket.Server;
  private htmlTemplate: string

  public constructor(opts: IServerOptions) {
    this.opts = withDefaultValues(opts || {}, {
      env: 'dev',
    });

    // setup the basics
    this.middleware = new MiddlewareStack();
    this.logger = new Logger();

    // load the app and config
    this.load(this.opts.app);

    // create the http and ws servers
    this.httpServer = this.config.equals('server.ssl.on', true) ? this.createHttpsServer() : this.createHttpServer();
    this.wsServer = this.createWsServer();
  }

  protected createHttpServer(): http.Server {
    let server = http.createServer({});
    server.on('error', this.onHttpError.bind(this));
    server.on('request', this.onHttpRequest.bind(this));
    server.on('upgrade', this.onHttpUpgrade.bind(this));
    return server;
  }

  protected createHttpsServer(): https.Server {
    let server = https.createServer({
      key: this.config.getOrThrow('server.ssl.key'),
      cert: this.config.getOrThrow('server.ssl.cert')
    });
    server.on('error', this.onHttpError.bind(this));
    server.on('request', this.onHttpRequest.bind(this));
    server.on('upgrade', this.onHttpUpgrade.bind(this));
    return server;
  }

  protected createWsServer(): WebSocket.Server {
    let server = new WebSocket.Server({ noServer: true });
    server.on('connection', this.onWsConnection.bind(this));
    return server;
  }

  protected getHttpListenOpts(): IHttpListenOptions {
    return {
      port: this.config.get<number>('server.port', 3000),
    };
  }

  protected getSessionOpts(): ISessionOptions {
    return {
      key: this.config.get<string>('session.key', 'session'),
      password: this.config.get<string>('session.secret', 'secret'),
      loggedInExpires: this.config.get<number|undefined>('session.loggedInExpires', undefined),
      loggedOutExpires: this.config.get<number|undefined>('session.loggedOutExpires', undefined),
    };
  }

  public async start(callback?: () => void): Promise<void> {
    debug('start');

    this.httpServer.listen(this.getHttpListenOpts(), () => {
      let msg = `elements is listening at ${this.url()}.`;
      this.logger.success(msg);
    });

    this.heartBeatIntervalId = this.startHeartBeat();
    process.on('uncaughtException', (err) => this.onUncaughtError(err));
    this.app.fire('started', [], this.app);
  }

  public restart(app: Application, changed: IDistJsonFileChangeSets) {
    debug('restart');
    this.logger.info("hot restart");
    this.app = app
    this.load(app);
    this.sendRestartMessage();
    app.fire('started', [], app);
    app.fire('restarted', [], app);
  }

  protected load(app: Application) {
    debug('load');
    this.config = findOrCreateAppConfig();
    this.app = app;
    this.loadHtmlTemplate();
    this.readDistJson();
    this.loadMiddleware();
  }

  protected loadMiddleware() {
    debug('load middleware');
    this.middleware.clear();
    this.middleware.add(new AssetMiddleware({ distJson: this.distJson }));
    this.middleware.add(new BodyMiddleware());
    this.middleware.add(new AppMiddleware({app: this.app}));
  }

  protected readDistJson() {
    debug('read build.json')
    try {
      let distJsonFilePath = path.join(process.cwd(), 'dist.json');
      this.distJson = JSON.parse(fs.readFileSync(distJsonFilePath, 'utf8'));
      setTimeout(() => this.delOldFiles(), 0);
    } catch(e) {
      this.logger.error('Error reading dist.json: %s', e);
    }
  }

  delOldFiles() {
    let distJsonFilePaths = new Set();

    for (let [targetName, distJsonTarget] of Object.entries(this.distJson.targets)) {
      Object.keys(distJsonTarget.files).forEach(distPath => {
        distJsonFilePaths.add(path.join(process.cwd(), distPath));
      });
    }

    walkSync(process.cwd(), ((entryPath: string, entryStats: fs.Stats) => {
      let fileName = path.basename(entryPath);

      if (fileName == 'dist.json') {
        return;
      }

      if (!entryStats.isDirectory()) {
        if (!distJsonFilePaths.has(entryPath)) {
          this.delFileEntrySafely(entryPath);
        }
      }
    }));

    walkSync(process.cwd(), ((entryPath: string, entryStats: fs.Stats) => {
      if (entryStats.isDirectory()) {
        try {
          let entries = fs.readdirSync(entryPath);
          if (entries.length == 0) {
            this.delDirEntrySafely(entryPath);
          }
        } catch (err) {
          debug('error reading directory %s. %s', entryPath, err);
        }
      }
    }));
  }

  delFileEntrySafely(entryPath: string): boolean {
    try {
      debug('deleting %s', entryPath);
      fs.unlinkSync(entryPath);
      return true;
    } catch(err) {
      debug('error deleting %s. %s', entryPath, err);
      return false;
    }
  }

  delDirEntrySafely(entryPath: string): boolean {
    try {
      debug('deleting %s', entryPath);
      fs.rmdirSync(entryPath);
      return true;
    } catch(err) {
      debug('error deleting %s. %s', entryPath, err);
      return false;
    }
  }

  url(): string {
    let addr = this.httpServer.address() as net.AddressInfo;
    let proto = 'http://';
    let host = this.opts.env === 'dev' ? 'localhost' : addr.address;

    let port: number = this.getHttpListenOpts().port;
    let portLabel: string;
    if (port == 80 || port == 443) {
      portLabel = '';
    } else {
      portLabel = ':' + port;
    }

    return proto + host + portLabel;
  }

  onUncaughtError(error: Error): void {
    this.logger.error('\n' + indent(error.stack, 2));
    process.exit(1);
  }

  /**
   * Handles http server errors like EADDRINUSE during startup. The errors here
   * are usually fatal.
   */
  onHttpError(error: Error): void {
    if (error['code'] === 'EADDRINUSE') {
      let port: number = this.getHttpListenOpts().port;
      this.logger.error(`It looks like another program is already using port ${port}. Try looking at your processes with the "ps" command.\nKill all node processes with "> sudo killall node".`);
      process.exit(1);
    }

    else {
      this.logger.error(String(error));
      process.exit(1);
    }
  }

  /**
   * Upgrade an http connection to a web socket connection.
   */
  onHttpUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    // ask the underlying web socket server to handle the upgrade, and attach
    // the session to the connection instance so we can access it for rpc method
    // calls.
    this.wsServer.handleUpgrade(req, socket, head, (socket) => {
      socket['ip'] = req.connection.remoteAddress!;
      socket['headers'] = req.headers;
      this.wsServer.emit('connection', socket);
    });
  }

  async onHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    debug('%s %s', req.method, req.url);

    if (req.url == '/favicon.ico') {
      res.statusCode = 200;
      res.end();
      return;
    }

    let timer = new Timer();
    timer.start();

    let session = createSessionFromHttp(req, res, this.getSessionOpts());
    let logger = this.createLoggerForSession(session);
    logger.tag('http', httpColor);

    if (req.method !== 'GET') {
      logger.log('%s %s', req.url, color(req.method.toLowerCase(), methodColor));
    } else {
      logger.log('%s', req.url);
    }

    let request = new ServerRequest({
      app: this.app,
      distJson: this.distJson,
      req: req,
      res: res,
      logger: logger,
      session: session,
      htmlTemplate: this.htmlTemplate,
    });

    try {
      await this.middleware.run(request);
      timer.stop();

      let statusColor: number;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        statusColor = successColor;
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        statusColor = warnColor;
      } else {
        statusColor = errColor;
      }

      logger.log('%s %s', req.url, color('(' + res.statusCode + ' - ' + timer.toString() + ')', statusColor));
    } catch(err) {
      timer.stop();
      logger.log('\n%s', indent(err.stack, 2));
      logger.log('%s %s', req.url, color('(' + err.constructor.name + ' ' + timer.toString() + ')', errColor));

      let errorEventName: string;
      // set the correct http status code for the error and assign the
      // corresponding event handler name
      if (err instanceof NotFoundError) {
        errorEventName = 'notFoundError';
        request.status(404);
      } else if (err instanceof NotAuthorizedError) {
        errorEventName = 'notAuthorizedError';
        request.status(401);
      } else {
        errorEventName = 'unhandledError';
        request.status(500);
      }

      try {
        // let the app decide what to do with the error.
        this.app.fire(errorEventName, [err], request);
      } catch (err) {
        // and if that fails at least set the 500 status code and then log the
        // secondary error here.
        request.status(500);
        logger.log('%s', indent(err.stack, 2));
      }
    } finally {
      if (!res.finished) {
        // make sure to end the request if it hasn't been ended yet.
        res.end();
      }
    }
  }

  onWsConnection(socket: WebSocket): void {
    debug('ws connection');
    socket['isAlive'] = true;
    socket.on('error', this.onWsError.bind(this, socket));
    socket.on('close', this.onWsClose.bind(this, socket));
    socket.on('message', this.onWsMessage.bind(this, socket));
    socket.on('pong', this.onWsPong.bind(this, socket));
  }

  /**
   * Handle a websocket error.
   */
  onWsError(socket: WebSocket, err: Error): void {
    debug('ws error %s', err);
  }

  /**
   * Handle a websocket close.
   */
  onWsClose(socket: WebSocket, code: number, message: string): void {
  }

  /**
   * Handle an incoming websocket message.
   */
  onWsMessage(socket: WebSocket, data: WebSocket.Data): void {
    try {
      let message = parse(data as string) as IMessage;
      let session = createSessionFromCookie(extractCookie(message.cookie), this.getSessionOpts());

      switch (message.type) {
        case 'call':
          this.onWsCallMessage(socket, session, message as ICallMessage);
          break;

        default:
          throw new StandardError(`Invalid message type: "${message.type}"`);
      }
    } catch (err) {
      this.sendErrorMessage(socket, undefined, err);
    }
  }

  async onWsCallMessage(socket: WebSocket, session: Session, message: ICallMessage) {
    let timer = new Timer();
    timer.start();

    let logger = this.createLoggerForSession(session);
    logger.tag('ws  ', wsColor);

    try {
      logger.log('%s', message.method);

      let retval = await findAndCallServiceFunction({
        session: session,
        logger: logger,
        method: message.method,
        args: message.args
      });

      this.sendReturnMessage(socket, session, message.id, retval);

      logger.log('%s %s', message.method, color('(return - ' + timer.toString() + ')', successColor));
    } catch (err) {
      logger.log('%s', err);
      logger.log('%s %s', message.method, color('(' + err.constructor.name + ' - ' + timer.toString() + ')', errColor));
      this.sendErrorMessage(socket, session, err, message.id);
    }
  }

  createLoggerForSession(session: Session): Logger {
    let logger = new Logger();
    if (typeof session == 'undefined') {
      logger.error('session is undefined');
      return logger;
    }
    let sessionId = session.id.slice(0, 5);
    let userId = session.userId ? session.userId.slice(0, 5) : '00000';
    logger.tag(`${sessionId}, ${userId}`, userIdColor);
    return logger;
  }

  /**
   * Handle the 'pong' event from a web socket. This will cause the socket to be
   * marked as active.
   */
  onWsPong(socket: WebSocket, data: Buffer): void {
    socket['isAlive'] = true;
  }

  /**
   * Starts the heart beat interval which will send a 'ping' message to all
   * connected clients on some interval (by default every 30 seconds). If the
   * heartbeat fails for a given client, that client's connection will be
   * terminated and cleaned up. Returns the interval id which can be used to
   * clear the interval when the server is stopped.
   */
  startHeartBeat(): NodeJS.Timer {
    return setInterval(() => {
      this.wsServer.clients.forEach(socket => {
        if (socket['isAlive'] === false) {
          // kill the socket if it didn't respond to the last ping.
          socket.terminate();
          return;
        }

        else {
          // mark the socket as dead and send it a ping signal. when we receive
          // the pong signal (hopefully before the next heart beat sweep) the
          // socket will be marked as alive again.
          socket['isAlive'] = false;
          socket.ping(() => {});
        }
      });
      let numConnectedClients = this.wsServer.clients.size;

      if (numConnectedClients > 0) {
        this.logger.info('%d connected %s', numConnectedClients, (numConnectedClients > 1) ? 'clients' : 'client');
      }
    }, HEARTBEAT_INTERVAL);
  }

  sendErrorMessage(socket: WebSocket, session: Session, error: any, id?: number): void {
    if (error && !error['_safe']) {
      error = new UnhandledError();
    }

    this.sendMessage(socket, this.createMessage<IErrorMessage>(session, {
      type: 'error',
      id: id,
      value: error
    }));
  }

  sendRestartMessage(): void {
    debug('broadcast restart message to %d clients', this.wsServer.clients.size);

    let message: IRestartMessage = {
      type: 'restart',
      bundles: this.distJson.targets['browser'].bundles
    }

    this.wsServer.clients.forEach((socket: WebSocket) => {
      this.sendMessage(socket, message);
    });
  }

  sendReturnMessage(socket: WebSocket, session: Session, id: number, retval: any): void {
    this.sendMessage(socket, this.createMessage<IReturnMessage>(session, {
      type: 'return',
      id: id,
      value: retval
    }));
  }

  createMessage<T extends IMessage>(session: Session | undefined, props: any): T {
    let message: T = {
      cookie: typeof session === 'undefined' ? '' : createCookieFromSession(session),
      csrf: '',
      ...props
    }

    return message;
  }

  sendMessage(socket: WebSocket, message: IMessage): void {
    socket.send(stringify(message));
  }

  loadHtmlTemplate() {
    try {
      // try using config/app.html first
      let filePath = path.join(process.cwd(), 'config', 'app.html');
      this.htmlTemplate = fs.readFileSync(filePath, 'utf8');
    } catch(err) {
      // if it doesn't exist then use the default
      this.htmlTemplate = defaultHtmlTemplate;
    }
  }
}
