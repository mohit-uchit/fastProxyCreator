import type React from 'react';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';
import LayoutContent from '@/components/layout-content';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Fast Proxy Creator',
  description: 'Create and install Squid Proxy on your Linux VPS in minutes',
  generator: 'darky',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <LayoutContent>
              {children}
            </LayoutContent>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
