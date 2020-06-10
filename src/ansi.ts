export function color(msg: string, value: number): string {
  return `\x1b[38;5;${value}m${msg}\x1b[0m`;
}

export function success(msg: string): string {
  return `\x1b[32m${msg}\x1b[0m`;
}
