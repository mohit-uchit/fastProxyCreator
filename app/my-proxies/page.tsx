'use client'

import { useAuth } from '@/components/auth-provider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProxyList from '@/components/proxy-list'

export default function MyProxiesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="container py-10">
        <div>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">My Proxies</h1>
      <ProxyList />
    </div>
  )
}