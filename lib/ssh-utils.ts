import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { Readable } from 'stream';
import { sendTelegramMessage } from './telegram';

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
  onLog?: (log: string) => void;
  telegramChatId?: string;
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

// Main function to set up Squid proxy
export async function setupSquidProxy(
  config: SSHConfig,
): Promise<ProxySetupResult> {
  validateConfig(config);
  const logger = createLogger(config.onLog);
  const conn = new Client();
  let stream: ClientChannel | null = null;

  try {
    logger.log('\n🚀 Starting Squid Proxy installation...\n');

    // Establish SSH connection
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        logger.log('✅ SSH connection established');
        resolve();
      });
      conn.on('error', err => {
        logger.log(`❌ SSH connection error: ${err.message}`);
        reject(new Error(`SSH connection error: ${err.message}`));
      });

      logger.log(`🔄 Connecting to ${config.host}...`);
      conn.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        readyTimeout: 30000,
      });
    });

    // Create shell session
    stream = await new Promise<ClientChannel>((resolve, reject) => {
      conn.shell((err, stream) => {
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

    // Check for pending reboot
    const rebootCheck = await executeCommand(
      stream,
      'test -f /var/run/reboot-required && echo "Reboot required" || echo "No reboot required"',
      logger,
    );
    if (rebootCheck.includes('Reboot required')) {
      logger.log(
        '⚠️ WARNING: System restart required. Installation may fail until reboot is performed.',
      );
    }

    // Installation steps with better logging
    const steps = [
      {
        name: 'System Update',
        command: 'sudo DEBIAN_FRONTEND=noninteractive apt-get update',
        message: '📡 Updating package lists...',
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
        validate: async (output: string) => {
          if (!stream) {
            throw new Error('SSH stream is not available');
          }
          // Verify apache2-utils installation
          const verifyCommand = 'which htpasswd';
          const verifyOutput = await executeCommand(
            stream,
            verifyCommand,
            logger,
          );
          if (!verifyOutput.includes('/usr/bin/htpasswd')) {
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
      },
      {
        name: 'Verify Service',
        command: 'sudo systemctl status squid --no-pager',
        message: '✅ Verifying Squid service status...',
      },
    ];

    // Execute commands sequentially
    for (const step of steps) {
      logger.log(`\n${step.message}`);
      const output = await executeCommand(stream, step.command, logger);

      // Validate step if validator exists
      if (step.validate) {
        try {
          await step.validate(output);
        } catch (error) {
          logger.log(
            `\n❌ Step "${step.name}" failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        }
      }

      // Add a small delay between steps to ensure logs are sent
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.log('\n✨ Installation completed successfully!\n');
    logger.log('📝 Proxy Details:');
    logger.log(`🌐 Proxy Address: ${config.host}:${config.proxyPort}`);
    logger.log(`👤 Username: ${config.proxyUsername}`);
    logger.log(`🔑 Password: ${config.proxyPassword}\n`);

    if (config.telegramChatId) {
      const telegramMsg =
        `✅ *Your Squid Proxy is ready!*\n` +
        `*Proxy:* \`${config.host}:${config.proxyPort}\`\n` +
        `*Username:* \`${config.proxyUsername}\`\n` +
        `*Password:* \`${config.proxyPassword}\``;
      `*Join:* \`@fast_proxy_creator\``;
      try {
        await sendTelegramMessage(config.telegramChatId, telegramMsg);
      } catch (err) {
        console.error('Failed to send Telegram message:', err);
      }
    }

    return {
      proxy: `${config.host}:${config.proxyPort}`,
      username: config.proxyUsername,
      password: config.proxyPassword,
      status: 'success',
      logs: logger.getLogs(),
    };
  } catch (error) {
    logger.log(
      `\n❌ Installation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
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
    conn.end();
  }
}
