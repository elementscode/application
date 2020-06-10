/**
 * Allows storing a promise as an object and calling resolve or reject on it at
 * a later time.
 *
 * Example:
 *
 *   let deferred = new Deferred();
 *
 *   let promise = deferred.promise;
 *   promise.then(value => console.log(value));
 *   promise.catch(err => console.error(err));
 *
 *   // resolve the deferred, which will call the 'then' method of the promise.
 *   setTimeout(() => deferred.resolve('value'));
 */
export class Deferred<T = any> {
  /**
   * Resolve the Promise.
   */
  public resolve: (...params: any[]) => any;

  /**
   * Reject the Promise.
   */
  public reject: (...params: any[]) => any;

  /**
   * The Promise.
   */
  public promise: Promise<T>;

  /**
   * Construct a new Deferred instance.
   */
  public constructor() {
    // to satisfy the typescript compiler we initialize these here.
    this.resolve = () => {};
    this.reject = () => {};

    // then reassign them once we have a promise.
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
