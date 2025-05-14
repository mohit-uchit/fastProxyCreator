export interface ProxyCheckResult {
  proxy: string;
  isAlive: boolean;
  responseTime?: number;
  error?: string;
}

export const checkProxy = async (proxyString: string): Promise<ProxyCheckResult> => {
  const [host, port, username, password] = proxyString.split(':');
  
  if (!host || !port || !username || !password) {
    return {
      proxy: proxyString,
      isAlive: false,
      error: 'Invalid proxy format'
    };
  }

  const startTime = Date.now();
  
  try {
    // Use the API route instead of direct fetch
    const response = await fetch('/api/check-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host,
        port,
        username,
        password
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Proxy check failed');
    }

    return {
      proxy: proxyString,
      isAlive: data.isAlive,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      proxy: proxyString,
      isAlive: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const checkProxies = async (proxyList: string[]): Promise<ProxyCheckResult[]> => {
  // Check multiple proxies concurrently with a limit
  const batchSize = 5;
  const results: ProxyCheckResult[] = [];

  for (let i = 0; i < proxyList.length; i += batchSize) {
    const batch = proxyList.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(proxy => checkProxy(proxy))
    );
    results.push(...batchResults);
  }

  return results;
};