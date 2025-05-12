import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Proxies | Fast Proxy Creator',
  description: 'View and manage your proxy servers'
}

export default function MyProxiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}