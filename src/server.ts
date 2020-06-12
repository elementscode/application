import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import * as WebSocket from 'ws';
import { homedir } from 'os';
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
import { Service } from './service';
import { Application } from './application';
import { AssetMiddleware } from './asset-middleware';
import { AppMiddleware } from './app-middleware';
import { MiddlewareStack } from './middleware-stack';
import { Session } from './session';
import { success } from './ansi';
import { onBeforeSendHeaders } from './headers';
import { call } from './call';
import { Config } from './config';
import {
  StandardError,
  UnhandledError,
  NotAcceptableError,
  NotFoundError,
  NotAuthorizedError,
} from './errors';
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
import {
  debug,
  getProjectConfig,
} from './utils';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const methodColor = 165;
const successColor = 2;
const errColor = 1;
const warnColor = 172;
const subtleColor = 8;
const userIdColor = 3;
const httpColor = 32;
const wsColor = 68;

export class IServerOptions {
  env: string;
  app: Application;
}

export class Server {
  private app: Application;
  private distJson: IDistJson;
  private heartBeatIntervalId: NodeJS.Timer;
  private httpServer: http.Server;
  private logger: Logger;
  private middleware: MiddlewareStack;
  private opts: IServerOptions;
  private config: Config;
  private wsServer: WebSocket.Server;

  public constructor(opts: IServerOptions) {
    this.opts = withDefaultValues(opts || {}, {
      env: 'dev',
    });

    this.logger = new Logger();
    this.httpServer = this.createHttpServer();
    this.wsServer = this.createWsServer();
    this.middleware = new MiddlewareStack();
    this.load(this.opts.app);
  }

  protected createHttpServer(): http.Server {
    let server = http.createServer(this.getHttpServerOpts());
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
      port: this.config.get<number>('http.port', 3000),
    };
  }

  protected getSessionOpts(): ISessionOptions {
    return {
      key: this.config.get<string>('session.key', 'elements_session'),
      password: this.config.get<string>('session.password', 'p@ssw0rd!'),
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
  }

  protected getHttpServerOpts(): http.ServerOptions {
    return {};
  }

  public restart(app: Application, changed: IDistJsonFileChangeSets) {
    this.logger.info("hot reboot");
    this.load(app);
    this.sendRestartMessage();
  }

  protected load(app: Application) {
    debug('load');
    this.config = getProjectConfig();
    this.app = app;
    this.readDistJson();
    this.loadMiddleware();
  }

  protected loadMiddleware() {
    debug('load middleware');
    this.middleware.clear();
    this.middleware.add(new AssetMiddleware({ distJson: this.distJson }));
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

    return proto + host + port;
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

    let session = Session.createFromHttp(req, res, this.getSessionOpts());

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

      if (err instanceof NotAuthorizedError) {
        request.status(401);
        if (this.app['_onNotAuthorizedErrorCb']) {
          this.app['_onNotAuthorizedErrorCb'].call(request, err);
        }
      } else {
        request.status(500);
        if (this.app['_onUnhandledErrorCb']) {
          this.app['_onUnhandledErrorCb'].call(req, err);
        }
      }
    } finally {
      if (!res.finished) {
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
      let session = Session.createFromCookie(message.cookie, this.getSessionOpts());

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

      let retval = await call({
        session: session,
        logger: logger,
        method: message.method,
        args: message.args
      });

      this.sendReturnMessage(socket, session, message.id, retval);

      logger.log('%s %s', message.method, color('(return - ' + timer.toString() + ')', successColor));
    } catch (err) {
      this.sendErrorMessage(socket, session, err, message.id);
      logger.log('%s %s', message.method, color('(' + err.constructor.name + ' - ' + timer.toString() + ')', errColor));
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
      cookie: typeof session === 'undefined' ? '' : session.toCookie(),
      csrf: '',
      ...props
    }

    return message;
  }

  sendMessage(socket: WebSocket, message: IMessage): void {
    socket.send(stringify(message));
  }
}
