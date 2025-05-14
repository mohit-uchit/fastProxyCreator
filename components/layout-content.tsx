"use client"

import { usePathname } from 'next/navigation'
import Header from '@/components/header'
import Footer from '@/components/footer'

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      {!pathname.includes('/install') && 
       !pathname.includes('/my-proxies') && 
       !pathname.includes('/proxy-checker') &&
       <Footer />}
    </div>
  )
}