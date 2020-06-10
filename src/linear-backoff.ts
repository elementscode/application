export class LinearBackoff {
  /**
   * The y-intercept
   */
  protected intercept: number;

  /**
   * The linear coefficient
   */
  protected coefficient: number;

  /**
   * The independent variable
   */
  protected x: number;

  /**
   * Construct a new LinearBackoff instance.
   *
   * @param min The minimum duration
   * @param step The difference in time between successive invocations
   * @param max The maximum duration
   */
  constructor(min = 0, step = 1000, protected max = 10_000) {
    this.intercept = min;
    this.coefficient = step;
    this.x = 0;
  }

  /**
   * Get the duration for the next invocation and increase the number of invocations by one.
   */
  public duration() {
    return Math.min(this.coefficient * this.x++ + this.intercept, this.max);
  }

  /**
   * Reset the number of invocations.
   */
  public reset() {
    this.x = 0;
  }
}
