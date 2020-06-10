import { json } from '@elements/json';

/**
 * Mark all instances of an Error class as safe.
 *
 * @param target - The constructor function.
 */
export function safe<T extends { new(...args: any[]): {}, _safe?: boolean }>(target: T) {
  target._safe = true;
  return target;
}

@json
export class StandardError {
  public message?: string;

  public code: string;

  public stack: any;

  public suggestions: string[];

  public name: string;

  /**
   * Whether the error is safe to travel over the wire to a client (e.g. the
   * browser or a console client).
   */
  protected _safe: boolean;

  /**
   * Constructs a new StandardError.
   */
  public constructor(message?: string) {
    this.name = this.constructor.name;
    this.message = message;
    this.suggestions = [];
    this._safe = !!(<typeof StandardError>this.constructor)._safe;
    this.stack = '';
    this.code = '';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    else {
      this.stack = new Error().stack;
    }
  }

  /**
   * Mark the error has safe to travel to the browser or another client.
   */
  public safe(): StandardError {
    this._safe = true;
    return this;
  }

  /**
   * Returns true if the error is safe to travel to the browser or another
   * client.
   */
  public isSafe(): boolean {
    return this._safe;
  }

  /**
   * Creates a suggestion to handle the error.
   */
  public suggest(suggestion): StandardError {
    this.suggestions.push(suggestion);
    return this;
  }

  /**
   * Convert the error to a string representation.
   */
  public toString(): string {
    return this.stack;
  }

  /**
   * Creates a new error.
   */
  public static create(message?: string): StandardError {
    return new this(message);
  }

  /**
   * True if the error is safe to go to the browser.
   */
  public static _safe?: boolean;
}

@json
@safe
export class UnhandledError extends StandardError {}

@json
@safe
export class NotFoundError extends StandardError {}

@json
@safe
export class NotAcceptableError extends StandardError {}

@json
@safe
export class NotAuthorizedError extends StandardError {}

@json
export class NotImplementedError extends StandardError {}

