import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { parse, stringify } from '@elements/json';
import {
  withDefaultValues,
  getUtcTimeNow,
} from '@elements/utils';
import { Application } from './application';
import { debug } from './utils';
import { BrowserRequest } from './browser-request';
import { Deferred } from './deferred';
import { Session } from './session';
import { LinearBackoff } from './linear-backoff';
import {
  StandardError
} from './errors';
import {
  IMessage,
  IClientMessage,
  IRestartMessage,
  ICallMessage,
  IReturnMessage,
  IErrorMessage,
  ILoader,
} from './types';

const SESSION_WILL_EXPIRE_LEAD_TIME = 60 * 1000;

declare global {
  interface Window {
    Loader: ILoader;
  }
}

export interface IBrowserOpts {
  app: Application
}

export interface IEvent {
  type: string;
  handler: (...any) => any;
  options: any;
}

enum WebSocketClientState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting'
}

/**
 * The browser class creates an environment for an application to run in. It
 * maintains the web socket connection to the server, manages hot reloads, and
 * the client side rpc system.
 */
export class Browser {
  /**
   * The application.
   */
  public app: Application;

  /**
   * Always good to have some options.
   */
  protected opts: IBrowserOpts;

  /**
   * An array of bound event handlers that we track so we can stop them when
   * we stop the application.
   */
  protected events: IEvent[];

  /**
   * Whether the browser host has started.
   */
  protected started: boolean;

  /**
   * The current page's virtual path (e.g. project/app/views/home/index.tsx).
   */
  protected vpath: string;

  /**
   * The web socket.
   */
  protected socket: WebSocket;

  /**
   * Outstanding websocket messages that are waiting for a reply. This allows us
   * to associate a response with the original message that was sent to the
   * server.
   */
  protected deferredByMessageId: {[index: string]: Deferred<any>};

  /**
   * The next message call tracking id. This is just an auto incrementing
   * number used to track web socket calls and their respective responses.
   */
  protected nextMessageId: number;

  /**
   * The send queue holds messages that are waiting to be sent. Messages are
   * queued if the web socket connection is not established yet.
   */
  protected sendQueue: IMessage[];

  /**
   * The instance of linear backoff that helps us keep track of reconnection
   * attempts
   */
  protected backoff: LinearBackoff;

  /**
   * Whether this client is trying to reconnect.
   */
  protected reconnecting: boolean;

  /**
   * The tiemout for the next reconnection attempt.
   */
  protected reconnectionTimeout: NodeJS.Timer;

  /**
   * The state of the web socket connection.
   */
  protected socketState: WebSocketClientState;

  /**
   * A timer that tells us when to fire the session.expired event.
   */
  protected sessionExpiredEventTimer?: NodeJS.Timer;

  /**
   * A timer that fires 1 minute before the session will expire.
   */
  protected sessionWillExpireEventTimer?: NodeJS.Timer;

  /**
   * Creates a new Browser instance.
   */
  public constructor(opts: IBrowserOpts) {
    this.opts = withDefaultValues(opts || {}, {});
    this.app = this.opts.app;
    this.events = [];
    this.sendQueue = [];
    this.nextMessageId = 0;
    this.deferredByMessageId = {};
    this.backoff = new LinearBackoff();
    this.socketState = WebSocketClientState.Disconnected;
  }

  /**
   * Start the browser host.
   */
  public start(): this {
    if (this.started) {
      return;
    }

    debug('start');
    this.createEvents();
    this.setSessionTimers();
    this.connect();
    this.started = true;
    return this;
  }

  /**
   * Stop this browser instance, disconnecting event handlers and closing the
   * websocket connection.
   */
  public stop(): this {
    debug('stop');

    if (!this.started) {
      return this;
    }

    // Remove all event listeners.
    this.events.forEach(event => {
      window.removeEventListener(event.type, event.handler, event.options);
    });

    // Stop the ws.
    if (this.socket) {
      this.socket.close();
    }

    // Mark our state as no longer started.
    this.started = false;

    return this;
  }

  /**
   * Try to reconnect to the server.
   */
  public reconnect() {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;

    let delay = this.backoff.duration();
    debug('attempting to reconnect in %sms', delay);

    this.reconnectionTimeout = setTimeout(this.connect.bind(this), delay);
  }

  /**
   * Reset the reconnection state.
   */
  public resetReconnect() {
    this.backoff.reset();
    this.reconnecting = false;
    clearTimeout(this.reconnectionTimeout);
  }

  /**
   * Connect to the socket server.
   * Repeated connection attempts will be ignored until the existing socket
   * is closed.
   */
  public connect() {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.socket = this.createWebSocket();
      this.socketState = WebSocketClientState.Disconnected;
    }

    // we're either connected, connecting, or closing
    else {
      debug(`Existing socket is not closed. Can't connect.`);
    }
  }

  /**
   * This will send any messages from the send queue. Messages are queued if the
   * connection is not ready yet.
   */
  protected flushSendQueue(): void {
    debug('flushing send queue with %s messages', this.sendQueue.length);
    let sendQueue = this.sendQueue;
    this.sendQueue = [];
    sendQueue.forEach(message => this.send(message));
  }

  /**
   * Creates a new web socket connection to the server.
   */
  protected createWebSocket(): WebSocket {
    debug('create websocket');
    let proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let url = proto + '://' + location.host;
    let socket = new WebSocket(url);
    socket.addEventListener('message', this.onWsMessage.bind(this));
    socket.addEventListener('close', this.onWsClose.bind(this));
    socket.addEventListener('error', this.onWsError.bind(this));
    socket.addEventListener('open', this.onWsOpen.bind(this));
    return socket;
  }

  /**
   * Hydrates a server rendered page.
   */
  protected hydrate() {
    let viewMetaEl = <HTMLMetaElement>document.querySelector('meta[name="elements:view"]');
    let dataMetaEl = <HTMLMetaElement>document.querySelector('meta[name="elements:data"]');

    if (!viewMetaEl) {
      return
    }

    let attrs: any;
    if (dataMetaEl) {
      try {
        attrs = JSON.parse(atob(dataMetaEl.content));
      } catch(err) {
        console.error(err);
        attrs = {};
      }
    } else {
      attrs = {};
    }

    let vpath = viewMetaEl.content;
    let exports = require(vpath);
    let view = exports.default;
    let el = React.createElement(view, attrs);
    debug('hydrate %s', vpath);
    this.setCurrentVPath(vpath);
    ReactDOM.hydrate(el, document.body.children[0]);
  }

  /**
   * Create the global window events.
   */
  protected createEvents() {
    this.events.push({
      type: 'DOMContentLoaded',
      handler: this.onDOMContentLoaded.bind(this),
      options: { capture: false },
    });

    this.events.push({
      type: 'click',
      handler: this.onClick.bind(this),
      options: { capture: false },
    });

    this.events.push({
      type: 'mousemove',
      handler: this.onMouseMove.bind(this),
      options: { capture: false },
    });

    this.events.push({
      type: 'keydown',
      handler: this.onKeyDown.bind(this),
      options: { capture: false },
    });

    this.events.push({
      type: 'popstate',
      handler: this.onPopState.bind(this),
      options: { capture: false },
    });

    this.events.push({
      type: 'unhandledrejection',
      handler: this.onUnhandledRejection.bind(this),
      options: { capture: false },
    });

    this.events.forEach(event => {
      window.addEventListener(event.type, event.handler, event.options);
    });
  }

  /**
   * Handles user actvity. Updates the last activity time property and triggers
   * the resumed activity handler if we're within the session expiration lead time.
   */
  protected onActivity(): void {
    // TODO
  }

  /**
   * Run a route for a given url.
   *
   * @param url - The url to find a route for and run.
   */
  public async run(url: string): Promise<void> {
    debug('run %s', url);

    let req = new BrowserRequest({
      app: this.app,
      browser: this,
      url: url,
      session: this.getSessionFromCookie(this.getCookie()) || new Session(),
    });

    try {
      let found = await this.app.run(req.parsedUrl.pathname, req);

      if (!found) {
        this.renderNotFoundPage(url);
      }
    } catch(err) {
      this.renderUnhandledErrorPage(err);
    }
  }

  public getSessionFromCookie(cookie: string): Session | undefined {
    if (!cookie || cookie.length == 0) {
      return undefined;
    }

    // <header>.<payload>.<signature>
    let payload = cookie.split('.')[1];

    let deserialized;
    try {
      deserialized = parse(atob(payload));
    } catch (err) {
      return undefined;
    }

    let session = new Session();
    session['id'] = deserialized['id'];
    session['userId'] = deserialized['userId'];
    session['csrf'] = deserialized['csrf'];
    session['expires'] = deserialized['expires'];
    session['timestamp'] = deserialized['timestamp'];

    return session;
  }

  public getCookie(): string {
    let cookie = document.cookie.split(';').find(cookie => /^session=/.test(cookie));
    
    if (!cookie) {
      return '';
    }

    // session=abc
    return cookie;
  }

  /**
   * Sets the current page's vpath.
   */
  public setCurrentVPath(vpath: string): this {
    this.vpath = vpath;
    return this;
  }

  /**
   * Gets the current vpath.
   */
  public getCurrentVPath(): string | undefined {
    return this.vpath;
  }

  /**
   * Navigate to the given url using browser push state.
   *
   * @param url - The url to go to.
   * @param [options]
   * @param [options.replace] - If this is true then we'll use
   * replaceState instead of pushState to update the browser url. It's useful in
   * cases where you don't want the new url to be part of the browser history so
   * that when the user clicks the back button they won't come back to this url.
   * Most of the time this should be left as false which is the default.
   */
  public go(url: string, options: any = {}): void {
    debug('go url: %s', url);

    if (!url) {
      throw new Error(`go(${url}) failed because the url must be of type "string" and instead it was "${typeof url}".`);
    }

    /**
     * If it's not the same origin punt to the new url.
     */
    if (!this.isSameOrigin(url)) {
      location.assign(url);
      return;
    }

    /**
     * If the history api is not supported we'll need to ask the user to update
     * their browser. But for now, we'll throw an error that clearly describes
     * the issue instead of waiting for a weird stack trace with some terrible
     * message like can't call pushState on undefined.
     */
    if (typeof window.history === 'undefined') {
      throw new Error(`We rely on the window.history api and you're using an older browser that doesn't have support for this. The solution is most likely to upgrade your browser. Very sorry for the inconvenience.`);
    }

    /**
     * Sometimes you don't want to store a url on the browser's history stack
     * (i.e. when user hits back button you don't want this url to be in that
     * stack). To accomplish this you can use replaceState instead of pushState.
     * The replace option will tell us to use replaceState.
     */
    if (options.replace || url == location.pathname) {
      window.history.replaceState({ /* state object */ }, '' /* title */, url);
      this.run(url);
    }

    /**
     * Otherwise use the pushState api to change the url in the browser AND add
     * the url to the browser history stack so when the user clicks the back
     * button they can go back to this page.
     */
    else {
      window.history.pushState({ /* state object */ }, '' /* title */, url);
      this.run(url);
    }
  }

  /**
   * Handle an unhandled promise rejection. This will most likely be because of
   * an rpc method call where the server sends an error message and it is
   * unhandled by the page.
   *
   * note: the event is not strongly typed because it looks like there's a
   * missing type definition in @types/node.
   */
  protected onUnhandledRejection(err: Error): void {
    debug('unhandled rejection probably from rpc call');
    this.renderUnhandledErrorPage(err);
  }

  /**
   * Renders the unhandled error page.
   */
  public renderUnhandledErrorPage(err: Error): void {
    console.error(err);
  }

  /**
   * Renders the not found page.
   */
  public renderNotFoundPage(url: string): void {
    console.error('%s not found', url);
  }

  /**
   * When the user clicks the back button the browser fires the popstate event
   * after changing the url. We will handle that event so that we can run the
   * route for that url.
   */
  protected onPopState(e: PopStateEvent) {
    debug('onPopState: %j', e);
    this.run(location.pathname + location.search);
  }

  protected onDOMContentLoaded(e: Event): void {
    this.hydrate();
  }

  /**
   * Root link click handler for the application. This method determines if the
   * link is in the same origin as the application, and if so, runs that route
   * by calling the `run` method. If the link is not the same origin (i.e. an
   * external website) then it skips navigating to that route from our app.
   */
  protected onClick(e: MouseEvent): void {
    debug('event: onClick')

    try {
      if (!(e.target instanceof Element)) {
        return;
      }

      let el = this.findParentNodeByTagName('A', e.target) as HTMLAnchorElement;

      // if there's no anchor element or no href then do nothing.
      if (!el || !el.href) {
        return;
      }

      // combine the pathname, query string and hash to form the full url for
      // the link.
      let url = el.pathname + el.search + el.hash;

      // ie9 omits the leading slash in pathname - so patch up if it's missing
      url = url.replace(/(^\/?)/,"/");

      // with no meta key pressed
      if (e.metaKey || e.ctrlKey || e.shiftKey)
        return;

      // aren't targeting a new window
      if (el.hasAttribute('target'))
        return;

      // if the download attribute is present let the browser make the download
      // request without running a route or changing the url.
      if (el.hasAttribute('download'))
        return;

      // external to the app
      if (!this.isSameOrigin(el.href))
        return;

      // note that we _do_ handle links which point to the current URL
      // and links which only change the hash.
      e.preventDefault();

      // manage setting the new state and maybe pushing onto the pushState stack
      this.go(url);
    } catch (err) {
      // make sure we can see any errors that are thrown before going to the
      // server.
      e.preventDefault();
      throw err;
    }
  }

  /**
   * Handles the mousemove event so that we can track user activity and
   * inactivity.
   */
  protected onMouseMove(e: MouseEvent): void {
    this.onActivity();
  }

  /**
   * Handles the keydown event so that we can track user activity and
   * inactivity.
   */
  protected onKeyDown(e: KeyboardEvent): void {
    this.onActivity();
  }

  /**
   * Climbs up the DOM tree, starting with the passed in node until we find a
   * parent of the given type. For example, we might climb the DOM tree until we
   * find the first anchor tag where the type === 'A'.
   *
   * @param tagName - The uppercase node tag (e.g. DIV, A, LI, UL)
   * @param node - The starting node in the tree.
   */
  protected findParentNodeByTagName(tagName: string, node: Element | null): Node | undefined {
    if (!node) {
      return undefined;
    }

    else if (node.tagName === tagName) {
      return node;
    }

    else {
      return this.findParentNodeByTagName(tagName, node.parentNode as Element);
    }
  }

  /**
   * Returns true if the url is the same origin as the app.
   */
  protected isSameOrigin(url: string): boolean {
    // note: passing the second parameter is required if we want to handle
    // relative paths like /one. this will also work for urls that go to
    // different domains like "//www.amazon.com/assets/one".
    let parsedUrl = new URL(url, location.origin /* relative base */);
    let result = parsedUrl.origin === location.origin;
    return result;
  }

  protected onWsMessage(event: MessageEvent): void {
    let data = event.data;

    if (typeof data === 'string') {
      let message: IMessage = parse(data);
      debug('ws message: %s', message.type);

      if (typeof message.cookie === 'string' && message.cookie.length > 0) {
        document.cookie = message.cookie;
      }

      switch(message.type) {
        case 'restart':
          this.onRestartMessage(message as IRestartMessage);
          break;

        case 'return':
          this.onReturnMessage(message as IReturnMessage);
          break;

        case 'error':
          this.onErrorMessage(message as IErrorMessage);
          break;

        default:
          throw new Error(`Invalid message: ${event.data}`);
      }
    }
  }

  /**
   * Handles the web socket close event.
   *
   * Attempts to reconnect if the socket was closed abnormally.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Properties
   */
  protected onWsClose(event: CloseEvent): void {
    debug('closed socket connection. reason: %j, code: %j', event.reason, event.code);
    if (event.code === 1006) {
      debug('abnormal close, will attempt reconnection');
      this.reconnecting = false;
      this.reconnect();
    }
    this.socketState = WebSocketClientState.Disconnected;
  }

  /**
   * Handles the web socket error event.
   */
  protected onWsError(event: Event): void {
    debug('web socket error');
    if (this.reconnecting) {
      debug('reconnect attempt error');
    }
  }

  /**
   * Handles the socket open event. This event handler sets the state to
   * connected and flushes any pending messages from the send queue. If
   * this open event is the result of a reconnection, it resets the
   * reconnection state.
   */
  protected onWsOpen(event: Event): void {
    debug('web socket open');
    if (this.reconnecting) {
      debug('reconnection success');
    }
    this.socketState = WebSocketClientState.Connected;
    this.resetReconnect();
    this.flushSendQueue();
  }

  public call<T = any>(method: string, ...args: any[]): Promise<T> {
    let deferred = new Deferred();
    let id = this.getNextMessageId();
    this.deferredByMessageId[id] = deferred;
    this.sendCallMessage(id, method, args);
    return deferred.promise;
  }

  protected sendCallMessage(id: number, method: string, args: any[]): void {
    this.send(this.createMessage<ICallMessage>({
      type: 'call',
      id: id,
      method: method,
      args: args,
    }));
  }

  public createMessage<T extends IClientMessage>(props: any): T {
    let message: T = {
      cookie: this.getCookie(),
      csrf: '',
      ...props
    }
    return message;
  }

  protected getNextMessageId(): number {
    return this.nextMessageId++;
  }

  /**
   * Send a websocket message to the server.
   *
   * @param message - The message to send.
   */
  public send(message: IMessage): this {
    //this.socket.send(stringify(message));

    if (!this.socket) {
      throw new Error(`No socket. Can't send message.`);
    }

    // if we're in the reconnecting state, attempt to reconnect now
    if (this.reconnecting) {
      this.connect();
    }

    // if the web socket isn't connected yet then queue the message
    if (this.socketState !== WebSocketClientState.Connected) {
      debug('not connected yet so queueing message until we are');
      this.sendQueue.push(message);
    }

    else {
      // IMessage object so serialize it to json
      if (typeof message === 'object' && message.hasOwnProperty('type')) {
        let msg = stringify(message);
        debug('sending websocket message %s', msg);
        this.socket.send(msg);
      }

      // otherwise just send it directly
      else {
        debug('sending raw websocket message');
        this.socket.send(message as any);
      }
    }

    return this;
  }

  protected onRestartMessage(message: IRestartMessage): void {
    debug('restart');
    window['Bundles'] = message.bundles;
    window['Loader'].load(this.getCurrentVPath(), () => {
      this.run(location.pathname + location.search + location.hash);
    });
  }

  /**
   * Call return value response message received from server.
   */
  protected onReturnMessage(message: IReturnMessage): void {
    let deferred: Deferred = this.getAndDeleteDeferredCall(message.id)
    this.setCookie(message.cookie);
    deferred.resolve(message.value);
  }

  /**
   * Sets the browser cookie based on an rpc call response from the server. This
   * allows the same cookie to be used in http and ws.
   */
  protected setCookie(cookie?: string): void {
    document.cookie = cookie;
    this.setSessionTimers();
  }

  /**
   * Sets up the session timers from the cookie.
   */
  protected setSessionTimers(): void {
    let cookie = this.getCookie();

    if (typeof cookie !== 'undefined') {
      let session = this.getSessionFromCookie(cookie);
      debug('updating session cookie timers');
      clearTimeout(this.sessionWillExpireEventTimer);
      clearTimeout(this.sessionExpiredEventTimer);
      if (session && typeof session.expires !== 'undefined') {
        let expires = session.expires;
        let expiresInMs = expires - getUtcTimeNow();
        if (expiresInMs >= 0) {
          if ((expiresInMs - SESSION_WILL_EXPIRE_LEAD_TIME) >= 0) {
            this.sessionWillExpireEventTimer = setTimeout(() => {
              let session = this.getSessionFromCookie(this.getCookie());
              if (session && session.expires == expires) {
                debug('session will expire in %dms', SESSION_WILL_EXPIRE_LEAD_TIME);
                // TODO emit event
              }
            }, expiresInMs - SESSION_WILL_EXPIRE_LEAD_TIME);

            this.sessionExpiredEventTimer = setTimeout(() => {
              let session = this.getSessionFromCookie(this.getCookie());
              if (session && session.expires == expires) {
                // session in browser is the same one this expiry is for so emit
                // the expired event.
                // TODO emit event
                debug('session expired');
              } else {
                // cookie must have been updated in another tab, so we'll update
                // it here.
                this.setSessionTimers();
              }
            }, expiresInMs);
          }
        }
      }
    }
  }

  /**
   * Error message received from the server. If it's associated with a message
   * then call the reject() method on that deferred promise. Otherwise just
   * throws the error.
   */
  protected onErrorMessage(message: IErrorMessage): void {
    if (typeof message.id !== 'undefined') {
      let deferred = this.getAndDeleteDeferredCall(message.id);
      deferred.reject(message.value);
    }

    else {
      throw message.value;
    }
  }

  /**
   * When we make a web socket call to the server, we can create an id for that
   * request and when we get a response from the server it will include the id
   * in the response. This allows us to correlate a response with the original
   * request. This method retrieves the original "deferred" object for the given
   * id, allowing us to "resolve" or "reject" the associated deffered promise.
   * If we don't find the entry for this id - this is an error condition.
   *
   * @param id - The id of the message. We'll use this to lookup into the
   * this.deferredByMessageId table.
   */
  protected getAndDeleteDeferredCall(id: number): Deferred<any> {
    // grab the previously stored deferred instance
    let deferred = this.deferredByMessageId[id];

    // this means we have a bug in our code somewhere - the orginal message
    // sender should store a deferred instance in the this.deferredByMessageId map.
    if (!deferred) {
      throw new StandardError(`Missing service call info for call with id ${id}.`);
    }

    // delete the entry since we don't need it any more.
    delete this.deferredByMessageId[id];

    // return the deferred so it can be resolved.
    return deferred;
  }
}
