"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      router.push("/install")
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 py-12">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Free Proxy Service</h1>
        <p className="max-w-[600px] text-muted-foreground md:text-xl">Get started with our free proxy service</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Free Plan</CardTitle>
          <CardDescription>Perfect for individual users</CardDescription>
          <div className="mt-4">
            <span className="text-4xl font-bold">Free</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>1 Proxy User</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>Full Install Access</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>SSH Key Authentication</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>Telegram Notifications</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>24/7 Support</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          {user ? (
            <Button className="w-full" onClick={handleContinue} disabled={isLoading}>
              {isLoading ? "Processing..." : "Continue to Install"}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href="/signup">Sign Up to Get Started</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
