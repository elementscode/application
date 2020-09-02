import { get, set } from '@elements/utils';
import {
  NotAcceptableError,
} from '@elements/error';

/**
 * Wraps an object with get and set methods for easier accessiblity of object
 * key values.
 */
export class ParamsObject {
  public constructor(value: any = undefined) {
    if (typeof value !== 'undefined') {
      Object.assign(this, value);
    }
  }

  public get<T = any>(key: string | Iterable<string>, defaultValue?: T): T | undefined {
    return get(this, key, defaultValue);
  }

  public getOrThrow<T = any>(key: string | Iterable<string>): T | undefined {
    let result: T | undefined = this.get<T>(key);
    if (typeof result === 'undefined') {
      throw new NotAcceptableError(`Missing parameter: "${key}"`);
    }
    return result;
  }

  public set<T = any>(key: string | Iterable<string>, value: T): T {
    return set(this, key, value);
  }
}
