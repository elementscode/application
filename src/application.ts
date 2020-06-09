import * as http from 'http';

class Response extends http.ServerResponse {
  public render(view: string, data: any): void {
  }
}

export type PageCallback = (this: IPageApi, req: http.IncomingMessage, res: Response) => Promise<void>;

export interface IPageApi {
  render(view: string);
}

export class Application {
  public page(url: string, callback: PageCallback) {
  }
}
