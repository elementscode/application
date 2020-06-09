/**
 * Indent all lines in a string by some amount, optionally skipping the first
 * line.
 */
export function indent(value: string, amount: number, skipFirstLine: boolean = false): string {
  let spaces: string = '';

  for (let idx = 0; idx < amount; idx++) {
    spaces += ' ';
  }

  return value
    .split('\n')
    .map((line, index) => {
      if (skipFirstLine && index == 0) {
        return line;
      }

      return spaces + line;
    })
    .join('\n');
}

