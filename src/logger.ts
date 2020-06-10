import { color } from './ansi';

function withLeadingZero(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

export class Logger {
  _tags: string[];

  public constructor() {
    this._tags = [];
  }

  public success(msg: string, ...args: any[]): this {
    this.log(color(msg, 2), ...args);
    return this;
  }

  public error(msg: string, ...args: any[]): this {
    this.log(color(msg, 1), ...args);
    return this;
  }

  public warn(msg: string, ...args: any[]): this {
    this.log(color(msg, 214), ...args);
    return this;
  }

  public info(msg: string, ...args: any[]): this {
    this.log(color(msg, 39), ...args);
    return this;
  }

  public log(msg: string, ...args: any[]): void {
    let tags = [this.getTimeStampTag()].concat(this._tags).join('');
    console.log(`${tags} ${msg}`, ...args);
  }

  public tag(value: string, colorValue: number): this {
    this._tags.push(this.getColorTag(value, colorValue));
    return this;
  }

  protected getTimeStampTag(): string {
    let date = new Date();
    let hour = date.getHours();
    let amOrPm = hour >= 12 ? 'pm' : 'am';

    if (hour === 0) {
      hour = 12;
    }

    let ts: string = [
      date.getFullYear(),
      '/',
      date.getMonth() + 1,
      '/',
      date.getDate(),
      ' ',
      withLeadingZero(hour),
      ':',
      withLeadingZero(date.getMinutes()),
      amOrPm
    ].join('');

    return this.getColorTag(ts, 8);
  }

  protected getColorTag(tag: string, colorValue: number): string {
    return color(`[${tag}]`, colorValue);
  }
}

export let logger = new Logger();
