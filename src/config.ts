import { get, set, push } from '@elements/utils';

export type ConfigCallback = (this: Config, config?: Config) => void;

export class Config {
  private _data: any;

  public constructor(callback?: any) {
    this._data = {};
    if (typeof callback === 'function') {
      callback.call(this, this);
    } else if (callback instanceof Config) {
      this._data = callback._data;
    } else if (typeof callback === 'object') {
      this._data = callback;
    }
  }

  public env(): string {
    return process.env['ENV'] || 'dev';
  }

  public is(value: string): boolean {
    return this.env() === value;
  }

  /**
   * Given a path, returns the value of the property at that path. If there is an
   * undefined value anywhere along the path, instead of throwing an error, the
   * value undefined is returned. Alternatively, you can provide a default value
   * to be returned in the event of an undefined value.
   *
   * Examples:
   *
   *   Given a config object like this:
   *
   *   {
   *     hello: {
   *       world: 'v1',
   *       values: ['one']
   *     }
   *   }
   *
   *   this.get('hello.world') => 'v1'
   *   this.get('hello.values.0') => 'one'
   *   this.get('hello.world.what') => undefined
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   *
   * @param defaultValue - A default value. If the the property value is
   * undefined the defaultValue will be returned.
   */
  public get<V = any>(path: string | Iterable<string>, defaultValue?: V): V {
    return get(this._data, path, defaultValue);
  }

  /**
   * Calls the get method and if the result is undefined and there is no
   * defaultValue this method throws an error.
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   *
   * @param defaultValue - A default value. If the the property value is
   * undefined the defaultValue will be returned.
   */
  public getOrThrow<V = any>(path: string | Iterable<string>, defaultValue?: any): V {
    let result = this.get(path, defaultValue);

    if (typeof result === 'undefined' && arguments.length === 1) {
      throw new Error(`Missing required config value: "${path}".`);
    }

    return result;
  }

  /**
   * Pushes a value onto an array located at the key path specified by the path
   * parameter. If the property for the given key path is not defined, it is
   * initialized to an array. If the property value already exists and is not an
   * array this method throws an error. This method returns the value so that it
   * can be pushed and then used immediately.
   *
   * Example:
   *
   *   this.push('build.steps', BuildStep.create('some description', function() {}));
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   *
   * @param value - The value to push onto the array.
   */
  public push(path: string | Iterable<string>, value: any): any {
    return push(this._data, path, value);
  }

  /**
   * Updates or sets a value at the given path.
   *
   * @param path - The path to the value.
   * @param callback - A callback function that will be called with the existing
   * value, or undefined if there is no existing value, and should return the
   * new value.
   */
  public update(path: string, callback: (value: any) => any): any {
    let existing = get(this._data, path);
    return this.set(path, callback(existing));
  }

  /**
   * Returns true if the value at the given path is equal to the provided value.
   *
   * @param path - The path to the value.
   * @param value - The value to test equality against.
   */
  public equals(path: string, value: any): boolean {
    return this.get(path) === value;
  }

  /**
   * Returns true if a value at the given path is defined.
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   */
  public has(path: string | Iterable<string>): boolean {
    return !!get(this._data, path);
  }

  /**
   * Sets a config value at the given path and returns the value.
   *
   * Example:
   *
   *   this.set('hello.world', 'v1');
   *   this.get('hello.world') => 'v1'
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   *
   * @param value - The value to set.
   */
  public set(path: string | Iterable<string>, value: any): any {
    set(this._data, path, value);
    return value;
  }

  /**
   * Sets a config value at the given path if it is not already defined. Returns
   * the exisiting or new value to the caller.
   *
   * @param path - The string path of the property key, or an iterable (e.g.
   * array) object of strings that together form the path. For example:
   * 'some.path.to.key' or ['first.path', 'second.path'] which becomes
   * 'first.path.second.path'.
   *
   * @param value - The value to set.
   */
  public setIfNotDefined(path: string | Iterable<string>, value: any): any {
    let existing = get(this._data, path);

    if (typeof existing === 'undefined') {
      set(this._data, path, value);
      return value;
    }

    else {
      return existing;
    }
  }

  /**
   * Merge object into this config.
   */
  public assign(other: any, path?: string): this {
    if (typeof other !== 'object') {
      throw new Error(`Expected assign(other, ...) parameter to be an object but got "${typeof other}" instead.`);
    }

    // example: this.assign(require('./http')). if the export of the require has
    // a 'default' it must be the default export, so use that instead.
    if (other.default) {
      other = other.default;
    }

    // if the other one is another Config, just grab its data and we'll merge it
    // into ours.
    if (other instanceof Config) {
      other = other['_data'];
    }

    // merge the other object at the designated path
    if (path) {
      let existing = this.setIfNotDefined(path, {});
      let assigned = Object.assign(existing, other);
      this.set(path, assigned);
    }

    // merge the other object into the main data object
    this._data = Object.assign(this._data, other);

    return this;
  }

  /**
   * Returns a shallow clone of the options data.
   */
  public toObject(): any {
    return Object.assign({}, this._data);
  }

  /**
   * Creates a new Config instance.
   */
  public static create(callback?: any): Config {
    return new Config(callback);
  }
}
