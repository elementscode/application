import { ServerRequest } from './server-request';

export class BodyMiddleware {
  constructor() {
  }

  async run(req: ServerRequest, next: () => Promise<void>): Promise<void> {
  }
}
