export async function checkProxyStatus(proxy: {
  ip: string
  port: string
  username: string
  password: string
}): Promise<boolean> {
  try {
    const response = await fetch('/api/check-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proxy: `http://${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`
      })
    });

    const data = await response.json();
    return data.isLive;
  } catch (error) {
    console.error('Error checking proxy status:', error);
    return false;
  }
}