import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';

interface PoolConnection {
  id: string;
  client: Client;
  inUse: boolean;
  host: string;
  lastUsed: Date;
}

class SSHPoolManager extends EventEmitter {
  private static instance: SSHPoolManager;
  private pool: Map<string, PoolConnection[]> = new Map();
  private maxConnectionsPerHost: number = 3;
  private maxRetries: number = 3;
  private retryDelay: number = 2000;

  private constructor() {
    super();
    this.startCleanupInterval();
  }

  public static getInstance(): SSHPoolManager {
    if (!SSHPoolManager.instance) {
      SSHPoolManager.instance = new SSHPoolManager();
    }
    return SSHPoolManager.instance;
  }

  private getHostKey(host: string, port: number = 22): string {
    return `${host}:${port}`;
  }

  private async createConnection(config: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
  }): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      const timeout = setTimeout(() => {
        client.removeAllListeners();
        reject(new Error('Connection timeout'));
      }, 30000);

      client.once('ready', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.connect({
        ...config,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1'
          ]
        }
      });
    });
  }

  public async acquireConnection(config: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
  }): Promise<Client> {
    const hostKey = this.getHostKey(config.host, config.port);
    
    if (!this.pool.has(hostKey)) {
      this.pool.set(hostKey, []);
    }

    const connections = this.pool.get(hostKey)!;
    
    // Try to find an available connection
    const availableConn = connections.find(conn => !conn.inUse);
    if (availableConn) {
      availableConn.inUse = true;
      availableConn.lastUsed = new Date();
      return availableConn.client;
    }

    // Create new connection if pool isn't full
    if (connections.length < this.maxConnectionsPerHost) {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const client = await this.createConnection(config);
          const connection: PoolConnection = {
            id: Math.random().toString(36).substring(7),
            client,
            inUse: true,
            host: config.host,
            lastUsed: new Date()
          };
          
          connections.push(connection);
          return client;
        } catch (error) {
          lastError = error as Error;
          if (attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            continue;
          }
        }
      }
      
      throw lastError || new Error('Failed to create connection');
    }

    // Wait for an available connection
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        const conn = connections.find(c => !c.inUse);
        if (conn) {
          clearInterval(checkInterval);
          conn.inUse = true;
          conn.lastUsed = new Date();
          resolve(conn.client);
        } else if (attempts > 30) { // 30 seconds timeout
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for available connection'));
        }
      }, 1000);
    });
  }

  public releaseConnection(client: Client): void {
    for (const connections of this.pool.values()) {
      const connection = connections.find(conn => conn.client === client);
      if (connection) {
        connection.inUse = false;
        connection.lastUsed = new Date();
        break;
      }
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }

  private cleanupIdleConnections(): void {
    const now = new Date();
    for (const [hostKey, connections] of this.pool.entries()) {
      const activeConnections = connections.filter(conn => {
        if (!conn.inUse && now.getTime() - conn.lastUsed.getTime() > 300000) {
          conn.client.end();
          return false;
        }
        return true;
      });
      
      if (activeConnections.length === 0) {
        this.pool.delete(hostKey);
      } else {
        this.pool.set(hostKey, activeConnections);
      }
    }
  }
}

export const sshPool = SSHPoolManager.getInstance();