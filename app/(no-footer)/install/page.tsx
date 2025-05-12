'use client';

import type React from 'react';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Info, Terminal, Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function InstallPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState('');
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState('password');
  const [password, setPassword] = useState('');
  const [sshKeyFile, setSshKeyFile] = useState<File | null>(null);
  const [proxyPort, setProxyPort] = useState('3128');
  const [proxyUsername, setProxyUsername] = useState('darky');
  const [proxyPassword, setProxyPassword] = useState('');
  const [telegramChatId, setTelegramChatId] = useState("");
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [error, setError] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [installSuccess, setInstallSuccess] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);

  // Enhanced auth check
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Generate random password
  const generateRandomPassword = () => {
    setIsGeneratingPassword(true);
    const randomChars = Math.random().toString(36).substring(2, 10);
    setProxyPassword(randomChars);
    setIsGeneratingPassword(false);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check if file is a PPK file
      if (!file.name.endsWith('.ppk')) {
        setError('Only PPK files are allowed');
        setSshKeyFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setSshKeyFile(file);
      setError('');
    }
  };

  // Validate form
  const validateForm = () => {
    // IPv4 regex pattern
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

    if (!ipAddress) {
      setError('IP Address is required');
      return false;
    }

    if (!ipv4Pattern.test(ipAddress)) {
      setError('Invalid IPv4 address format');
      return false;
    }

    const octets = ipAddress.split('.').map(Number);
    for (const octet of octets) {
      if (octet < 0 || octet > 255) {
        setError('IP Address octets must be between 0 and 255');
        return false;
      }
    }

    if (!username) {
      setError('Username is required');
      return false;
    }

    if (authMethod === 'password' && !password) {
      setError('Password is required');
      return false;
    }

    if (authMethod === 'ssh' && !sshKeyFile) {
      setError('SSH Key file is required');
      return false;
    }

    if (!proxyPort) {
      setError('Proxy Port is required');
      return false;
    }

    if (
      isNaN(Number(proxyPort)) ||
      Number(proxyPort) < 1 ||
      Number(proxyPort) > 65535
    ) {
      setError('Proxy Port must be a number between 1 and 65535');
      return false;
    }

    if (!proxyUsername) {
      setError('Proxy Username is required');
      return false;
    }

    if (!proxyPassword) {
      setError('Proxy Password is required');
      return false;
    }
    return true;
  };

  // Add SSE connection effect
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (installationId) {
      eventSource = new EventSource(
        `/api/install-proxy/stream?id=${installationId}`,
      );

      eventSource.onopen = () => {
        setTerminalOutput(prev => [...prev, 'Connected to server...']);
      };

      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              setTerminalOutput(prev => [...prev, 'Connection established']);
              break;
            case 'log':
              setTerminalOutput(prev => [...prev, data.message]);
              break;
            case 'complete':
              setInstallSuccess(true);
              setIsInstalling(false);
              eventSource?.close();
              break;
            case 'error':
              console.error('Installation error:', data.message);
              setTerminalOutput(prev => [...prev, `Error: ${data.message}`]);
              setError(data.message);
              setIsInstalling(false);
              eventSource?.close();
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
          setTerminalOutput(prev => [
            ...prev,
            'Error processing server response',
          ]);
          setError('Error processing server response');
        }
      };

      eventSource.onerror = error => {
        console.error('SSE connection error:', error);
        setTerminalOutput(prev => [...prev, 'Lost connection to server']);
        setError('Lost connection to server');
        setIsInstalling(false);
        eventSource?.close();
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [installationId]);

  // Auto-hide success card after 8 seconds
  useEffect(() => {
    if (installSuccess) {
      const timer = setTimeout(() => setInstallSuccess(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [installSuccess]);

  // Update handleSubmit to use streaming endpoint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      setIsInstalling(true);
      setTerminalOutput(['Preparing installation...']);
      setInstallSuccess(false);
      setInstallationId(null);

      // Read SSH key file if using SSH authentication
      let sshKeyContent = null;
      if (authMethod === 'ssh' && sshKeyFile) {
        sshKeyContent = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result);
          reader.readAsText(sshKeyFile);
        });
      }

      const response = await fetch('/api/install-proxy/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAddress,
          username,
          authMethod,
          password: authMethod === 'password' ? password : undefined,
          sshKeyFile: authMethod === 'ssh' ? sshKeyContent : undefined,
          proxyPort,
          proxyUsername,
          proxyPassword,
          telegramChatId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start installation');
      }

      setInstallationId(data.installationId);
    } catch (error) {
      console.error('Installation error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Installation failed';
      setError(errorMessage);
      setTerminalOutput(prev => [...prev, `Error: ${errorMessage}`]);
      setIsInstalling(false);
    }
  };
  // Add loading state
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container py-8 relative">
      {/* Success Card Overlay */}
      {installSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-green-100 dark:bg-green-900 p-2">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-green-800 dark:text-green-300">
                    Installation Successful!
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-green-700 dark:text-green-400">
                  Your Squid Proxy has been successfully installed. Check your
                  Telegram for the credentials.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">Install Squid Proxy</h1>

      <Tabs defaultValue="form">
        <TabsList className="mb-4">
          <TabsTrigger value="form">Configuration</TabsTrigger>
          <TabsTrigger value="terminal" disabled={terminalOutput.length === 0}>
            Terminal Output
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Server Configuration</CardTitle>
                  <CardDescription>
                    Enter your server details to install Squid Proxy
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="ip-address">IP Address</Label>
                      <Input
                        id="ip-address"
                        placeholder="192.168.1.1"
                        value={ipAddress}
                        onChange={e => setIpAddress(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="root"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-method">Authentication Method</Label>
                      <Select value={authMethod} onValueChange={setAuthMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select authentication method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="password">Password</SelectItem>
                          <SelectItem value="ssh">SSH Key File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {authMethod === 'password' ? (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required={authMethod === 'password'}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="ssh-key">SSH Key File (.ppk)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="ssh-key"
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".ppk"
                            required={authMethod === 'ssh'}
                          />
                        </div>
                        {sshKeyFile && (
                          <p className="text-sm text-muted-foreground">
                            Selected file: {sshKeyFile.name}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="proxy-port">Proxy Port</Label>
                      <Select value={proxyPort} onValueChange={setProxyPort}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select port" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3128">3128 (Default)</SelectItem>
                          <SelectItem value="8080">8080</SelectItem>
                          <SelectItem value="8000">8000</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>

                      {proxyPort === 'custom' && (
                        <Input
                          className="mt-2"
                          placeholder="Enter custom port"
                          value={proxyPort === 'custom' ? '' : proxyPort} // Fix this line
                          onChange={e => {
                            const value = e.target.value;
                            // Validate port number
                            if (
                              /^\d*$/.test(value) &&
                              Number(value) >= 1 &&
                              Number(value) <= 65535
                            ) {
                              setProxyPort(value);
                            }
                          }}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-username">Proxy Username</Label>
                      <Input
                        id="proxy-username"
                        placeholder="darky"
                        value={proxyUsername}
                        onChange={e => setProxyUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proxy-password">Proxy Password</Label>
                      <div className="flex gap-2">
                        <Input
                          id="proxy-password"
                          type="text"
                          value={proxyPassword}
                          onChange={e => setProxyPassword(e.target.value)}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateRandomPassword}
                          disabled={isGeneratingPassword}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telegram-chatid">Telegram Chat ID</Label>
                      <Input
                        id="telegram-chatid"
                        placeholder="123456789"
                        value={telegramChatId}
                        onChange={e => setTelegramChatId(e.target.value)}
                        type="number"
                      />
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Important</AlertTitle>
                      <AlertDescription>
                        Make sure to start the Telegram bot
                        @fast_proxy_creator_bot first to receive installation
                        details.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isInstalling}
                    >
                      {isInstalling ? 'Installing...' : 'Install Proxy'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>

            <div>
              {terminalOutput.length > 0 ? (
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Terminal Output
                    </CardTitle>
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      ref={terminalRef}
                      className="bg-black text-green-400 p-4 rounded-md h-[500px] overflow-y-auto font-mono text-sm"
                    >
                      {terminalOutput.map((line, index) => (
                        <div key={index} className="mb-1">
                          {line}
                        </div>
                      ))}
                      {isInstalling && <div className="animate-pulse">_</div>}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Installation Guide</CardTitle>
                    <CardDescription>
                      Follow these steps to install Squid Proxy on your server
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold">1. Server Requirements</h3>
                      <p className="text-sm text-muted-foreground">
                        You need a Linux VPS with root access. Ubuntu or Debian
                        is recommended.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold">2. Fill in the Form</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your server details, authentication method, and
                        proxy configuration.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold">3. Install Proxy</h3>
                      <p className="text-sm text-muted-foreground">
                        Click the Install button and wait for the installation
                        to complete.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold">4. Receive Credentials</h3>
                      <p className="text-sm text-muted-foreground">
                        Your proxy credentials will be sent to your Telegram
                        account.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="terminal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Terminal Output</CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-md h-[600px] overflow-y-auto font-mono text-sm">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="mb-1">
                    {line}
                  </div>
                ))}
                {isInstalling && <div className="animate-pulse">_</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
