import * as path from 'path';
import * as createDebugger from 'debug';
import { Config } from './config';

export let debug = createDebugger('@elements/application');

export function getProjectConfig(): Config {
  try {
    let exports = require(path.join(process.cwd(), 'config'));
    if (exports instanceof Config) {
      return exports;
    } else if (exports.default instanceof Config) {
      return exports.default;
    } else {
      return new Config();
    }
  } catch(err) {
    return new Config();
  }
}
