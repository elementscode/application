import { get, set } from '@elements/utils';

// TODO how do I enhance the object?
export interface IEnhancedObject {
  set<T = any>(key: string | Iterable<string>, value: T): T;
  get<T = any>(key: string | Iterable<string>, defaultValue: T): T | undefined;
}

// export function createSuperObject<T = any>(obj: T): T & IEnhancedObject {
//   obj.get = get.bind(undefined, obj);
//   obj.set = set.bind(undefined, obj);
//   return obj;
// }
