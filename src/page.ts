import { Component } from './component';
import { Session } from './session';
import { call, getSession, go } from './helpers';

export class Page<T = any> extends Component<T> {
  public call<T = any>(method: string, ...args: any[]): Promise<T> {
    return call<T>(method, ...args);
  }

  public getSession(): Session {
    return getSession();
  }

  public go(url: string, options: any = {}): void {
    go(url, options);
  }
}
