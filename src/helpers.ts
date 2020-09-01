import { Session } from './session';

export function call<T = any>(method: string, ...args: any[]): Promise<T> {
  throw new Error(`call(...) is only allowed in the browser. Try this.call(...) from your route function instead.`);
}

export function getSession(): Session {
  throw new Error(`getSession(...) is only allowed in the browser. Try this.session from your route or service function instead.`);
}

export function go(url: string, options: any = {}): void {
  throw new Error(`go(...) is only allowed in the browser. Try this.go from your route function instead.`);
}
