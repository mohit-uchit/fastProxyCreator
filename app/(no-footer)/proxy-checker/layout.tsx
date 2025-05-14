import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Proxy Checker | Fast Proxy Creator',
  description: 'Check your proxy servers status'
}

export default function ProxyCheckerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}