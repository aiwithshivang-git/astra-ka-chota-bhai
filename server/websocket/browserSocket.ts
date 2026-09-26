import type { WebSocket } from 'ws';
import type { SocketMessage } from '../types.js';

export class BrowserSocket {
  private clients = new Set<WebSocket>();

  add(client: WebSocket): void {
    this.clients.add(client);
    client.on('close', () => this.clients.delete(client));
  }

  get hasClients(): boolean { return this.clients.size > 0; }

  send(message: SocketMessage): void {
    const encoded = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(encoded);
    }
  }
}
