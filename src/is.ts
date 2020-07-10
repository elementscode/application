/**
 * A placeholder function that allows executing a block of code conditionally,
 * if the current build target we are executing in matches the parameter target.
 * For exmple: is('browser') or is('server'). Elements will remove any code not
 * for a given target, at build time, using these function calls as markers.
 */
export function is(target: string): boolean {
  return true;
}
