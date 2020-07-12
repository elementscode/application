import { json } from '@elements/json';
import { bytesToBase64, base64ToBytes } from './base64';

export interface IFileJsonValue {
  name: string;
  size: number;
  type: string;
  body: string;
}

@json
export class File {
  size: number;
  name: string;
  type: string;
  body: Uint8Array;

  constructor(name: string) {
    this.name = name;
    this.size = 0;
    this.type = '';
  }

  toJSONValue(): IFileJsonValue {
    return {
      name: this.name,
      size: this.size,
      type: this.type,
      body: bytesToBase64(this.body)
    }
  }

  static fromJSONValue(value: IFileJsonValue): File {
    let file = new File(value.name);
    file.size = value.size;
    file.type = value.type;
    file.body = base64ToBytes(value.body);
    return file;
  }
}
