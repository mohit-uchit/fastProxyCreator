import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TextIcon as Telegram, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Contact Us
          </h1>
          <p className="mt-4 text-muted-foreground">
            Have questions or need help? Get in touch with our team.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Telegram className="h-5 w-5" />
                Telegram
              </CardTitle>
              <CardDescription>
                Contact us via Telegram for quick responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Our Telegram bot is available 24/7 to assist you with your proxy
                setup and management.
              </p>
              <Button asChild>
                <Link
                  href="https://t.me/@fast_proxy_creator_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Telegram className="mr-2 h-4 w-4" />
                  @fast_proxy_creator_bot
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email
              </CardTitle>
              <CardDescription>
                Send us an email for detailed inquiries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                For business inquiries, support requests, or any other
                questions, feel free to email us.
              </p>
              <Button asChild variant="outline">
                <a href="mailto:deadesc.darky@gmail.com">
                  <Mail className="mr-2 h-4 w-4" />
                  deadesc.darky@gmail.com
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">How do I install a Squid Proxy?</h3>
              <p className="text-muted-foreground">
                Sign up for an account, subscribe to our service, and use our
                Install Proxy tool to set up your proxy in minutes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">
                What server types are supported?
              </h3>
              <p className="text-muted-foreground">
                Our tool works with most Linux VPS servers, including Ubuntu,
                Debian, and CentOS.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">
                How do I receive my proxy credentials?
              </h3>
              <p className="text-muted-foreground">
                Your proxy credentials will be sent to your Telegram account
                after installation is complete.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Can I install multiple proxies?</h3>
              <p className="text-muted-foreground">
                Yes, you can install as many proxies as you need with your
                subscription.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
