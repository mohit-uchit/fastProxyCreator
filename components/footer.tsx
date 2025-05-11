import Link from 'next/link';
import { TextIcon as Telegram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t bg-background">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Fast Proxy Creator</h3>
            <p className="text-muted-foreground">
              Create and install Squid Proxy on your Linux VPS in minutes.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Telegram className="h-5 w-5" />
                <Link
                  href="https://t.me/fast_proxy_creator_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  @fast_proxy_creator_bot
                </Link>
              </li>
              <li>
                <a
                  href="mailto:deadsec.darky@gmail.com"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  deadsec.darky@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Fast Proxy Creator. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
