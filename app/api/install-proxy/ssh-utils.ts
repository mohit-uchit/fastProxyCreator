import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { Readable } from 'stream';

// Interfaces for configuration and results
export interface SSHConfig {
  host: string;
  username: string;
  password?: string;
  privateKey?: string;
  port?: number;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
}

export interface ProxySetupResult {
  proxy: string;
  username: string;
  password: string;
  status: 'success' | 'error';
  logs: string[];
}

// Utility to validate configuration
const validateConfig = (config: SSHConfig): void => {
  if (!config.host || !config.username) {
    throw new Error('Host and username are required');
  }
  if (!config.password && !config.privateKey) {
    throw new Error('Either password or privateKey must be provided');
  }
  if (!/^\d{1,5}$/.test(config.proxyPort) || parseInt(config.proxyPort) > 65535) {
    throw new Error('Invalid proxy port');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(config.proxyUsername)) {
    throw new Error('Invalid proxy username');
  }
};

// Logger utility with timestamps
const createLogger = () => {
  const logs: string[] = [];
  return {
    log: (message: string) => {
      const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
      logs.push(timestampedMessage);
    },
    getLogs: () => logs,
  };
};

// Execute a single command with timeout and retry
const executeCommand = async (
  stream: any,
  command: string,
  logger: ReturnType<typeof createLogger>,
  timeoutMs: number = 300000,
  retries: number = 2,
): Promise<string> => {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      return await new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        let commandCompleted = false;

        logger.log(`Executing (Attempt ${attempt + 1}/${retries + 1}): ${command}`);

        // Avoid double sudo
        const cmd = command.includes('apt-get')
          ? `timeout ${timeoutMs / 1000} bash -c 'DEBIAN_FRONTEND=noninteractive ${command}'`
          : command;

        stream.write(`${cmd}\n`);

        const timeout = setTimeout(() => {
          if (!commandCompleted) {
            stream.write('\x03'); // Send CTRL+C
            stream.write('sudo killall apt apt-get dpkg\n');
            reject(new Error(`Command timed out after ${timeoutMs / 1000}s: ${command}`));
          }
        }, timeoutMs);

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString();
          output += chunk;
          logger.log(chunk);

          // Handle interactive prompts
          if (chunk.includes('[Y/n]') || chunk.includes('Do you want to continue?')) {
            stream.write('y\n');
            return;
          }

          // Check for command completion
          if (chunk.includes('root@') || chunk.includes('$')) {
            commandCompleted = true;
            clearTimeout(timeout);

            if (
              command.includes('apt-get install') &&
              !output.includes('Setting up') &&
              !output.includes('is already the newest version') &&
              !output.includes('Reading package lists') // Fallback for partial success
            ) {
              reject(new Error(`Package installation failed: ${output}`));
              return;
            }

            resolve(output);
          }
        });

        stream.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
          logger.log(`Error: ${errorOutput}`);
        });
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.log(`Attempt ${attempt + 1} failed: ${lastError.message}`);
      attempt++;
      if (attempt > retries) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retry
    }
  }

  throw lastError || new Error('Unknown error during command execution');
};

// Verify package installation
const verifyPackage = async (
  stream: Readable,
  packageName: string,
  logger: ReturnType<typeof createLogger>,
): Promise<boolean> => {
  try {
    const output = await executeCommand(stream, `dpkg -l | grep ${packageName}`, logger);
    return output.includes(packageName);
  } catch (error) {
    logger.log(`Failed to verify package ${packageName}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

// Main function to set up Squid proxy
export async function setupSquidProxy(config: SSHConfig): Promise<ProxySetupResult> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called from the server');
  }

  validateConfig(config);
  const logger = createLogger();
  let conn: Client | null = new Client();
  let stream: ClientChannel | null = null;

  try {
    // Establish SSH connection
    await new Promise<void>((resolve, reject) => {
      conn!.on('ready', () => {
        logger.log('SSH connection established');
        resolve();
      });
      conn!.on('error', (err) => {
        logger.log(`SSH Error: ${err.message}`);
        reject(err);
      });

      const connectConfig: ConnectConfig = {
        host: config.host,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        port: config.port || 22,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
      };

      conn!.connect(connectConfig);
    });

    // Create shell session
    stream = await new Promise<ClientChannel>((resolve, reject) => {
      conn!.shell((err, stream) => {
        if (err) {
          logger.log(`Shell error: ${err.message}`);
          reject(err);
        } else {
          logger.log('Shell session created');
          resolve(stream);
        }
      });
    });

    // Verify sudo access
    await executeCommand(stream, 'sudo -n true', logger);

    // Check for pending reboot
    const rebootCheck = await executeCommand(
      stream,
      'test -f /var/run/reboot-required && echo "Reboot required" || echo "No reboot required"',
      logger,
    );
    if (rebootCheck.includes('Reboot required')) {
      logger.log('WARNING: System restart required. Installation may fail until reboot is performed.');
    }

    // Installation steps
    const installationSteps = [
      { name: 'update', cmd: 'sudo apt-get update' },
      {
        name: 'apache2-utils',
        cmd: 'sudo apt-get install -y apache2-utils',
        verify: 'which htpasswd',
        package: 'apache2-utils',
      },
      {
        name: 'squid',
        cmd: 'sudo apt-get install -y squid',
        verify: 'which squid',
        package: 'squid',
      },
    ];

    for (const step of installationSteps) {
      await executeCommand(stream, step.cmd, logger);
      if (step.verify) {
        await executeCommand(stream, step.verify, logger);
      }
      if (step.package) {
        const isInstalled = await verifyPackage(stream, step.package, logger);
        if (!isInstalled) {
          throw new Error(`Package ${step.package} is not installed correctly`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Configuration commands
    const commands = [
      'sudo rm -f /etc/squid/squid.conf',
      'sudo dpkg --configure -a',
      'sudo mkdir -p /etc/squid',
      'sudo touch /etc/squid/passwd',
      `sudo htpasswd -cb /etc/squid/passwd ${config.proxyUsername} ${config.proxyPassword}`,
      `sudo tee /etc/squid/squid.conf << 'EOL'
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic realm proxy
acl authenticated proxy_auth REQUIRED
http_access allow authenticated
http_access deny all
http_port ${config.proxyPort}
visible_hostname proxy-server
EOL`,
      'sudo systemctl restart squid',
    ];

    for (const cmd of commands) {
      await executeCommand(stream, cmd, logger);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Verify service status
    const status = await executeCommand(stream, 'sudo systemctl status squid', logger);
    if (!status.includes('active (running)')) {
      throw new Error('Failed to start Squid service');
    }

    logger.log('Installation completed successfully');

    return {
      proxy: `${config.host}:${config.proxyPort}`,
      username: config.proxyUsername,
      password: config.proxyPassword,
      status: 'success',
      logs: logger.getLogs(),
    };
  } catch (error) {
    logger.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    if (stream) {
      stream.end();
    }
    if (conn) {
      conn.end();
    }
  }
}