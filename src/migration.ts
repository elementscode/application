import * as fs from 'fs';
import * as path from 'path';

export type MigrationFunction = () => void;

export interface IMigrationOpts {
  up: MigrationFunction;
  down: MigrationFunction;
}

export class Migration {
  private desc: string;
  private up: MigrationFunction;
  private down: MigrationFunction;

  public constructor(desc: string, opts: IMigrationOpts) {
    if (typeof opts !== 'object') {
      throw new Error(`missing up() and down() functions in migration.`);
    }

    if (typeof opts.up !== 'function') {
      throw new Error(`missing up() function in migration.`);
    }

    if (typeof opts.down !== 'function') {
      throw new Error(`missing down() function in migration.`);
    }

    this.desc = desc
    this.up = opts.up;
    this.down = opts.down;
  }

  public run(): Migration {
    switch (process.argv[2]) {
      case 'desc':
        console.log(this.desc);
        break;
      case 'up':
        this.up();
        break;
      case 'down':
        this.down();
        break;
      default:
        this.up();
        break;
    }

    return this;
  }

  public static create(desc: string, opts: IMigrationOpts): Migration {
    return new Migration(desc, opts);
  }
}

function formatDate(date: Date = new Date()): string {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  return year + '/' + pad(month) + '/' + pad(day);
}

function pad(value: number): string {
  return value < 10 ? '0'+String(value) : String(value);
}
