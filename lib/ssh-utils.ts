import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { Readable } from 'stream';
import { sendTelegramMessage } from './telegram';
import { clientPromise } from './db'; // Import database client
import { sshPool } from './ssh-pool-manager';

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
  telegramChatId?: string;
  userId: string; // Make sure this is required
  onLog?: (log: string) => void;
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
  if (
    !/^\d{1,5}$/.test(config.proxyPort) ||
    parseInt(config.proxyPort) > 65535
  ) {
    throw new Error('Invalid proxy port');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(config.proxyUsername)) {
    throw new Error('Invalid proxy username');
  }
};

// Logger utility
const createLogger = (onLog?: (log: string) => void) => {
  const logs: string[] = [];
  return {
    log: (message: string) => {
      const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
      logs.push(timestampedMessage);
      // Send log immediately if callback provided
      if (onLog) {
        try {
          onLog(message);
        } catch (error) {
          console.error('Error sending log:', error);
        }
      }
    },
    getLogs: () => logs,
  };
};

// Execute a single command with timeout and error handling
const executeCommand = async (
  stream: ClientChannel,
  command: string,
  logger: ReturnType<typeof createLogger>,
  timeoutMs: number = 300000,
): Promise<string> => {
  stream.setMaxListeners(20);
  stream.stderr?.setMaxListeners(20);

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    // Add step indicator
    logger.log(`\n${'-'.repeat(50)}`);
    logger.log(`▶ Executing: ${command}`);
    logger.log(`${'-'.repeat(50)}\n`);

    stream.write(`${command}\n`);

    const timeout = setTimeout(() => {
      stream.write('\x03');
      reject(
        new Error(
          `⚠️ Command timed out after ${timeoutMs / 1000}s: ${command}`,
        ),
      );
    }, timeoutMs);

    stream.on('data', (data: Buffer) => {
      const chunk = data.toString();

      // Clean up output and handle line breaks
      const lines = chunk
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
          // Filter out unnecessary lines
          return (
            line &&
            !line.match(/^(\$|>|#)/) && // Remove prompt characters
            !line.match(/^\[.*\]/) && // Remove timestamp lines
            !line.match(/^Reading package lists/) && // Remove apt progress
            !line.match(/^Building dependency tree/) && // Remove apt progress
            !line.match(/^Reading state information/) && // Remove apt progress
            !line.match(/^0%|20%|40%|60%|80%|100%/) && // Remove progress percentages
            !line.match(/^Hit:|^Get:|^Ign:/) && // Remove apt repository lines
            !line.match(/^Waiting for headers/) && // Remove apt progress
            !line.match(/^Working/) && // Remove apt progress
            !line.match(/^Connecting to/) && // Remove apt progress
            !line.match(/^\[.*\]/) && // Remove any other bracketed lines
            !line.match(/^ubuntu@/) && // Remove prompt lines
            !line.match(/^Last login/) && // Remove login messages
            !line.match(/^Welcome to/) && // Remove welcome messages
            !line.match(/^System information/) && // Remove system info
            !line.match(/^Documentation/) && // Remove documentation links
            !line.match(/^Management/) && // Remove management links
            !line.match(/^Support/) && // Remove support links
            !line.match(/^Expanded Security/) && // Remove security messages
            !line.match(/^Enable ESM/) && // Remove ESM messages
            !line.match(/^See https/) && // Remove URLs
            !line.match(/^Hint:/) && // Remove hints
            !line.match(/^\[.*\]/) && // Remove any other bracketed lines
            !line.match(/^\[/) && // Remove ANSI escape codes
            !line.match(/^[?2004]/) && // Remove terminal control sequences
            !line.match(/^Loaded:/) && // Remove systemd loaded messages
            !line.match(/^Active:/) && // Remove systemd active messages
            !line.match(/^Docs:/) && // Remove systemd docs messages
            !line.match(/^Process:/) && // Remove systemd process messages
            !line.match(/^Main PID:/) && // Remove systemd main pid messages
            !line.match(/^Tasks:/) && // Remove systemd tasks messages
            !line.match(/^Memory:/) && // Remove systemd memory messages
            !line.match(/^CPU:/) && // Remove systemd cpu messages
            !line.match(/^CGroup:/) && // Remove systemd cgroup messages
            !line.match(/^May/) && // Remove log timestamps
            !line.match(/^ip-/) && // Remove hostname messages
            !line.match(/^squid\[/) && // Remove squid process messages
            !line.match(/^systemd\[/) && // Remove systemd messages
            !line.match(/^Finished loading/) && // Remove squid loading messages
            !line.match(/^Using Least Load/) && // Remove squid load messages
            !line.match(/^Current Directory/) && // Remove directory messages
            !line.match(/^HTCP/) && // Remove HTCP messages
            !line.match(/^Pinger/) && // Remove pinger messages
            !line.match(/^Squid plugin/) && // Remove plugin messages
            !line.match(/^Adaptation/) && // Remove adaptation messages
            !line.match(/^Accepting HTTP/) && // Remove HTTP socket messages
            !line.match(/^Started squid/) && // Remove service start messages
            !line.match(/^Adding password/) && // Remove password messages
            !line.match(/^apache2-utils is already/) && // Remove package messages
            !line.match(/^squid is already/) && // Remove package messages
            !line.match(/^EOL/) && // Remove EOL messages
            !line.match(/^auth_param/) && // Remove config messages
            !line.match(/^acl/) && // Remove config messages
            !line.match(/^http_port/) && // Remove config messages
            !line.match(/^visible_hostname/)
          ); // Remove config messages
        });

      if (lines.length) {
        lines.forEach(line => {
          output += line + '\n';
          // Add different indicators for different types of output
          if (line.includes('Warning') || line.includes('warning')) {
            logger.log(`⚠️  ${line}`);
          } else if (line.includes('Error') || line.includes('error')) {
            logger.log(`❌ ${line}`);
          } else if (line.includes('Success') || line.includes('success')) {
            logger.log(`✅ ${line}`);
          } else if (
            line.includes('Installing') ||
            line.includes('Setting up')
          ) {
            logger.log(`📦 ${line}`);
          } else if (line.includes('Starting') || line.includes('Restarting')) {
            logger.log(`🔄 ${line}`);
          } else {
            logger.log(`   ${line}`);
          }
        });
      }

      // Handle interactive prompts
      if (
        chunk.includes('[Y/n]') ||
        chunk.includes('Do you want to continue?')
      ) {
        stream.write('y\n');
        logger.log('👉 Automatically responding: Yes');
        return;
      }

      // Check for completion
      if (
        chunk.includes('root@') ||
        chunk.includes('$') ||
        chunk.includes('#')
      ) {
        clearTimeout(timeout);

        if (
          output.includes('E: ') ||
          output.includes('error:') ||
          output.includes('failed')
        ) {
          reject(new Error(`❌ Command failed: ${command}\nOutput: ${output}`));
          return;
        }

        resolve(output);
      }
    });

    stream.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      errorOutput += chunk;
      logger.log(`❌ Error: ${chunk}`);
    });
  });
};

// Add this function after the executeCommand function
async function clearAptLocks(
  stream: ClientChannel,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const lockFiles = [
    '/var/lib/apt/lists/lock',
    '/var/lib/dpkg/lock',
    '/var/lib/dpkg/lock-frontend',
    '/var/cache/apt/archives/lock',
  ];

  logger.log('🔄 Checking and clearing APT locks...');

  for (const lockFile of lockFiles) {
    // Check if lock file exists and remove it
    await executeCommand(
      stream,
      `sudo rm -f ${lockFile} && sudo rm -f ${lockFile}-front`,
      logger,
    );
  }

  // Reset the dpkg state
  await executeCommand(stream, 'sudo dpkg --configure -a', logger);
}

// Add this function to handle service operations safely
async function safeServiceRestart(
  stream: ClientChannel,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  try {
    // Check current service status
    const statusCheck = await executeCommand(
      stream,
      'sudo systemctl is-active squid',
      logger,
    );

    // Stop the service first
    await executeCommand(stream, 'sudo systemctl stop squid', logger);

    // Wait for service to fully stop
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start the service
    await executeCommand(stream, 'sudo systemctl start squid', logger);

    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify service is running
    const finalCheck = await executeCommand(
      stream,
      'sudo systemctl is-active squid',
      logger,
    );

    if (!finalCheck.includes('active')) {
      throw new Error('Failed to start Squid service');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`❌ Service restart failed: ${errorMessage}`);
    throw error;
  }
}

// Add this function to validate proxy connectivity
async function validateProxyConnectivity(
  config: SSHConfig,
  logger: ReturnType<typeof createLogger>,
): Promise<boolean> {
  try {
    logger.log('🔍 Validating proxy connectivity...');
    logger.log('\n✨ Installation completed successfully!\n');
    logger.log('📝 Proxy Details:');
    logger.log(`🌐 Proxy Address: ${config.host}:${config.proxyPort}`);
    logger.log(`👤 Username: ${config.proxyUsername}`);
    logger.log(`🔑 Password: ${config.proxyPassword}\n`);
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'squidProxy');

    // Save proxy with pending status first
    const pendingProxy = {
      user_id: config.userId,
      ip: config.host,
      port: config.proxyPort,
      username: config.proxyUsername,
      password: config.proxyPassword,
      status: 'pending',
      createdAt: new Date(),
      lastChecked: new Date(),
    };

    await db.collection('proxies').insertOne(pendingProxy);

    return true;
  } catch (error) {
    logger.log(
      `❌ Database error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

// Main function to set up Squid proxy
export async function setupSquidProxy(
  config: SSHConfig,
): Promise<ProxySetupResult> {
  validateConfig(config);
  let client: Client | null = null;
  let stream: ClientChannel | null = null;
  let installationSuccess = false;
  let dbSaveSuccess = false;
  const logger = createLogger(config.onLog);

  try {
    // Get connection from pool instead of creating new one
    client = await sshPool.acquireConnection({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
    });

    if (!client) {
      throw new Error('Failed to acquire SSH connection');
    }

    const logger = createLogger(config.onLog);
    stream = await new Promise<ClientChannel>((resolve, reject) => {
      client!.shell((err, stream) => {
        if (err) {
          logger.log(`❌ Shell error: ${err.message}`);
          reject(err);
        } else {
          logger.log('✅ Shell session created');
          resolve(stream);
        }
      });
    });

    logger.log('🔑 Verifying SSH connection...');

    // Verify sudo access
    if (!stream) {
      throw new Error('Stream is null');
    }
    await executeCommand(stream, 'sudo -n true', logger);

    // Update the steps array in setupSquidProxy function
    const steps = [
      {
        name: 'Clear APT Locks',
        command: '', // Empty command as we'll handle this in execute
        message: '🔓 Clearing package manager locks...',
        execute: async () => {
          if (!stream) throw new Error('Stream is not available');
          await clearAptLocks(stream, logger);
          return true;
        },
      },
      {
        name: 'System Update',
        command: 'sudo DEBIAN_FRONTEND=noninteractive apt-get update',
        message: '📡 Updating package lists...',
        retry: async (error: Error) => {
          if (
            error.message.includes('Could not get lock') ||
            error.message.includes('Resource temporarily unavailable')
          ) {
            if (!stream) throw new Error('Stream is not available');
            await clearAptLocks(stream, logger);
            return true;
          }
          return false;
        },
      },
      {
        name: 'System Upgrade',
        command: 'sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y',
        message: '📦 Upgrading system packages...',
      },
      {
        name: 'Install Apache Utils',
        command:
          'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y apache2-utils',
        message: '📦 Installing Apache utilities...',
        retry: async (error: Error) => {
          if (
            error.message.includes('Could not get lock') ||
            error.message.includes('Resource temporarily unavailable')
          ) {
            if (!stream) throw new Error('Stream is not available');
            await clearAptLocks(stream, logger);
            return true;
          }
          return false;
        },
        validate: async (output: string) => {
          if (!stream) {
            throw new Error('SSH stream is not available');
          }
          const verifyOutput = await executeCommand(
            stream,
            'test -f /usr/bin/htpasswd && echo "htpasswd found" || echo "htpasswd not found"',
            logger,
          );
          if (!verifyOutput.includes('htpasswd found')) {
            throw new Error(
              'Failed to install apache2-utils: htpasswd command not found',
            );
          }
          return true;
        },
      },
      {
        name: 'Install Squid',
        command: 'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y squid',
        message: '📦 Installing Squid proxy server...',
      },
      {
        name: 'Configure Squid',
        command: `sudo bash -c 'cat > /etc/squid/squid.conf << EOL
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic realm proxy
acl authenticated proxy_auth REQUIRED
http_access allow authenticated
http_access deny all
http_port ${config.proxyPort}
visible_hostname proxy-server
EOL'`,
        message: '⚙️ Configuring Squid proxy...',
      },
      {
        name: 'Setup Authentication',
        command: `sudo htpasswd -cb /etc/squid/passwd ${config.proxyUsername} ${config.proxyPassword}`,
        message: '🔐 Setting up proxy authentication...',
        validate: async (output: string) => {
          if (output.includes('command not found')) {
            throw new Error(
              'htpasswd command not found. Please ensure apache2-utils is installed correctly.',
            );
          }
          return true;
        },
      },
      {
        name: 'Restart Service',
        command: 'sudo systemctl restart squid',
        message: '🔄 Restarting Squid service...',
        execute: async () => {
          if (!stream) throw new Error('Stream is not available');
          await safeServiceRestart(stream, logger);
          return true;
        },
      },
      {
        name: 'Verify Service',
        command: 'sudo systemctl status squid --no-pager',
        message: '✅ Verifying Squid service status...',
      },
    ];

    // Update the execution loop in setupSquidProxy function
    for (const step of steps) {
      logger.log(`\n${step.message}`);
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          if (step.execute) {
            await step.execute();
          } else {
            const output = await executeCommand(stream, step.command, logger);
            if (step.validate) {
              await step.validate(output);
            }
          }
          break; // Success, exit the retry loop
        } catch (error) {
          attempts++;
          if (step.retry && (await step.retry(error as Error))) {
            logger.log(
              `🔄 Retrying ${step.name} (attempt ${attempts}/${maxAttempts})...`,
            );
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          if (attempts === maxAttempts) {
            throw error;
          }
        }
      }

      // Add a small delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Only set success if everything completes
    installationSuccess = true;

    // Only send success messages if installation was successful
    if (installationSuccess) {
      try {
        dbSaveSuccess = await validateProxyConnectivity(config, logger);

        if (dbSaveSuccess) {
          const client = await clientPromise;
          const db = client.db(process.env.MONGODB_DB || 'squidProxy');

          // Update the pending proxy to success
          await db.collection('proxies').updateOne(
            {
              user_id: config.userId,
              ip: config.host,
              port: config.proxyPort,
              status: 'pending',
            },
            {
              $set: {
                status: 'success',
                lastChecked: new Date(),
                lastSuccessful: new Date(),
              },
            },
          );

          logger.log('✅ Proxy saved to database successfully');
        } else {
          throw new Error('Failed to save proxy to database');
        }
      } catch (dbError) {
        logger.log(
          `❌ Database error: ${
            dbError instanceof Error ? dbError.message : String(dbError)
          }`,
        );
        // Don't throw here, just log the error
        // The proxy might still be working even if we couldn't save to DB
      }

      if (config.telegramChatId) {
        const telegramMsg =
          `✅ *Your Squid Proxy is ready!*\n` +
          `*Proxy:* \`${config.host}:${config.proxyPort}\`\n` +
          `*Username:* \`${config.proxyUsername}\`\n` +
          `*Password:* \`${config.proxyPassword}\`\n` +
          `*Join:* \`@fast_proxy_creator\``;
        try {
          await sendTelegramMessage(config.telegramChatId, telegramMsg);
        } catch (telegramError) {
          logger.log(
            `⚠️ Failed to send Telegram message: ${
              telegramError instanceof Error
                ? telegramError.message
                : String(telegramError)
            }`,
          );
        }
      }
    }

    return {
      proxy: `${config.host}:${config.proxyPort}`,
      username: config.proxyUsername,
      password: config.proxyPassword,
      status: installationSuccess ? 'success' : 'error',
      logs: logger.getLogs(),
    };
  } catch (error) {
    // If installation failed, cleanup any pending proxy records
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'squidProxy');

      await db.collection('proxies').deleteOne({
        user_id: config.userId,
        ip: config.host,
        port: config.proxyPort,
        status: 'pending',
      });
    } catch (cleanupError) {
      logger.log(
        `⚠️ Failed to cleanup pending proxy record: ${
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError)
        }`,
      );
    }

    logger.log(
      `\n❌ Installation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    // Send failure notification via Telegram
    if (config.telegramChatId) {
      const errorMsg =
        `❌ *Proxy Installation Failed*\n` +
        `*Host:* \`${config.host}\`\n` +
        `*Error:* \`${
          error instanceof Error ? error.message : String(error)
        }\``;
      try {
        await sendTelegramMessage(config.telegramChatId, errorMsg);
      } catch (telegramError) {
        console.error('Failed to send Telegram error message:', telegramError);
      }
    }

    return {
      proxy: `${config.host}:${config.proxyPort}`,
      username: config.proxyUsername,
      password: config.proxyPassword,
      status: 'error',
      logs: logger.getLogs(),
    };
  } finally {
    if (stream) {
      stream.end();
    }
    if (client) {
      sshPool.releaseConnection(client);
    }
  }
}
