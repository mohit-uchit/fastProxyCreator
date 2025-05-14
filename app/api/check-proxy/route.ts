import { NextResponse } from 'next/server';
import { request } from 'http';

export async function POST(req: Request) {
  try {
    const { host, port, username, password } = await req.json();

    return new Promise((resolve) => {
      const proxyReq = request({
        host,
        port: parseInt(port),
        method: 'CONNECT',
        path: 'ip-api.com:80',
        headers: {
          'Proxy-Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        },
        timeout: 10000,
      });

      proxyReq.on('connect', (res, socket) => {
        if (res.statusCode === 200) {
          socket.destroy();
          resolve(NextResponse.json({ isAlive: true }));
        } else {
          resolve(NextResponse.json({ isAlive: false, error: 'Connection failed' }));
        }
      });

      proxyReq.on('error', (err) => {
        resolve(NextResponse.json({ isAlive: false, error: err.message }));
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        resolve(NextResponse.json({ isAlive: false, error: 'Timeout' }));
      });

      proxyReq.end();
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}