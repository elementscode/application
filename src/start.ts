import * as http from 'http';
import { createServerListener } from './server';
import { Application } from './application';

export function start(callback: () => Application) {
  let server = http.createServer(createServerListener());
  server.listen(3000, () => console.log('listening on port 3000'));
}
