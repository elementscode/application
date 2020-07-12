export function call<T = any>(method: string, ...args: any[]): Promise<T> {
  throw new Error(`The call(...) function can only be used in the browser. Try using this.call(...) from your page route function instead.`);
}
