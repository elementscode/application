export class File {
  size: number;
  name: string;
  contentType: string;
  body: Uint8Array;

  constructor(name: string) {
    this.name = name;
    this.size = 0;
    this.contentType = '';
  }
}
