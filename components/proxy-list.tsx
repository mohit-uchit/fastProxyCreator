"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { columns, Proxy } from "@/app/(no-footer)/my-proxies/columns"
import { DataTable } from "@/components/data-table"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Check } from "lucide-react"

export default function ProxyList() {
  const { user } = useAuth()
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [loading, setLoading] = useState(true)
  const [copyingAll, setCopyingAll] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchProxies()
    }
  }, [user])

  const fetchProxies = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/proxies", {
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch proxies")
      }
      
      const data = await response.json()
      setProxies(data)
    } catch (error) {
      console.error('Error fetching proxies:', error)
      toast({
        title: "Error",
        description: "Failed to load proxies",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyAllProxies = async () => {
    try {
      setCopyingAll(true)
      const proxyStrings = proxies
        .map((proxy) => `${proxy.ip}:${proxy.port}:${proxy.username}:${proxy.password}`)
        .join("\n")
      await navigator.clipboard.writeText(proxyStrings)
      toast({
        title: "Success",
        description: "All proxies copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy proxies",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => {
        setCopyingAll(false)
      }, 1000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Total Proxies: {proxies.length}
        </h2>
        <Button 
          onClick={copyAllProxies}
          className="relative"
          disabled={copyingAll}
        >
          {copyingAll ? (
            <Check className="h-4 w-4 mr-2 text-green-500 animate-in zoom-in duration-300" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy All
        </Button>
      </div>
      <DataTable columns={columns} data={proxies} />
    </div>
  )
}