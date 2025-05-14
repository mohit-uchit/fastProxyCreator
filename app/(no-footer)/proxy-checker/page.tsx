'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { CheckCircle, XCircle, Copy, Loader2, Check, ClipboardList } from 'lucide-react'
import { checkProxies, ProxyCheckResult } from '@/lib/proxy-checker'
import { useToast } from '@/components/ui/use-toast'

export default function ProxyCheckerPage() {
  const [proxies, setProxies] = useState('')
  const [results, setResults] = useState<ProxyCheckResult[]>([])
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCheck = async () => {
    try {
      setChecking(true)
      const proxyList = proxies
        .split('\n')
        .map(p => p.trim())
        .filter(p => p)

      if (!proxyList.length) {
        toast({
          title: 'Error',
          description: 'Please enter at least one proxy',
          variant: 'destructive'
        })
        return
      }

      const results = await checkProxies(proxyList)
      setResults(results)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to check proxies',
        variant: 'destructive'
      })
    } finally {
      setChecking(false)
    }
  }

  const copyLiveProxies = async () => {
    const liveProxies = results
      .filter(r => r.isAlive)
      .map(r => r.proxy)
      .join('\n')

    await navigator.clipboard.writeText(liveProxies)
    setCopied(true)
    toast({
      title: 'Success',
      description: 'Live proxies copied to clipboard'
    })

    // Reset copy state after 2 seconds
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const renderResults = () => {
    if (checking) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Checking your proxies...</p>
        </div>
      )
    }

    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ClipboardList className="h-8 w-8 mb-4" />
          <p>Paste your proxies and click check to start</p>
          <p className="text-sm mt-2">Format: ip:port:username:password</p>
        </div>
      )
    }

    const liveProxies = results.filter(r => r.isAlive)
    const deadProxies = results.filter(r => !r.isAlive)

    return (
      <>
        <div className="flex justify-between items-center mb-2 text-sm text-muted-foreground">
          <div className="flex gap-4">
            <span>Total: {results.length}</span>
            <span className="text-green-500">Live: {liveProxies.length}</span>
            <span className="text-red-500">Dead: {deadProxies.length}</span>
          </div>
        </div>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {results.map((result, index) => (
            <div 
              key={index}
              className={`flex items-center justify-between p-2 rounded border
                ${result.isAlive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}
            >
              <div className="flex items-center gap-2">
                {result.isAlive ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-mono text-sm">{result.proxy}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.isAlive ? (
                  <span className="text-sm text-green-500">
                    {result.responseTime}ms
                  </span>
                ) : (
                  <span className="text-sm text-red-500">
                    {result.error || 'Failed'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Proxy Checker</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Input Proxies</h2>
          <Textarea
            placeholder="Enter proxies (one per line)&#10;Example:&#10;192.168.1.1:8080:user:pass&#10;10.0.0.1:3128:admin:secret"
            value={proxies}
            onChange={(e) => setProxies(e.target.value)}
            className="min-h-[200px] mb-4 font-mono"
          />
          <Button 
            onClick={handleCheck}
            disabled={checking}
            className="w-full"
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check Proxies'
            )}
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Results</h2>
            {results.some(r => r.isAlive) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyLiveProxies}
                className="gap-2"
                disabled={copied}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Live
                  </>
                )}
              </Button>
            )}
          </div>

          {renderResults()}
        </Card>
      </div>
    </div>
  )
}