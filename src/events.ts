export class EventApi {
  _stopped: boolean;

  public constructor() {
    this._stopped = false;
  }

  public stop() {
    this._stopped = true;
  }

  public isStopped(): boolean {
    return !!this._stopped;
  }
}

export class EventHandler<T = any> {
  private _handlers: {[event: string]: ((...args: any[])=>any)[]};
  private _thisArg: T;

  public constructor(thisArg: T) {
    this._handlers = {};
    this._thisArg = thisArg;
  }

  public on(event: string, callback: (...args: any[]) => any) {
    if (!this._handlers[event]) {
      this._handlers[event] = [];
    }

    this._handlers[event].push(callback);
  }

  public fire(event: string, ...args: any[]) {
    let handlers = this._handlers[event] || [];
    let api = new EventApi();
    for (let handler of handlers) {
      handler.apply(this._thisArg, args.concat([api]));
      if (api.isStopped()) {
        return;
      }
    }
  }
}
