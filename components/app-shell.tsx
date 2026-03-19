import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { RefreshScanButton } from '@/components/refresh-scan-button';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/tracker', label: 'CV Tracker' },
  { href: '/saved', label: 'Saved' },
  { href: '/applied', label: 'Applied' },
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f7f0]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight text-ink">
              Ireland Data Analytics Job Radar
            </Link>
            <p className="mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Freshness-first daily application workflow
            </p>
          </div>

          <div className="flex items-center gap-2">
            <RefreshScanButton>
              <RefreshCw className="h-4 w-4" />
              Refresh Scan
            </RefreshScanButton>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-primary hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
