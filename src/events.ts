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

export class EventSystem {
  private _handlers: {[event: string]: ((...args: any[])=>any)[]};

  public constructor() {
    this._handlers = {};
  }

  public on(event: string, callback: (...args: any[]) => any) {
    if (!this._handlers[event]) {
      this._handlers[event] = [];
    }

    this._handlers[event].push(callback);
  }

  public fire(event: string, args: any[], thisArg: any) {
    let handlers = this._handlers[event] || [];
    let api = new EventApi();
    for (let handler of handlers) {
      handler.apply(thisArg, args.concat([api]));
      if (api.isStopped()) {
        return;
      }
    }
  }
}
