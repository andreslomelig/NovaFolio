'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { label: 'Clients', href: '/clients' },
  { label: 'Cases',   href: '/cases' },      // (placeholder route for future)
  { label: 'Documents', href: '/documents' },// (placeholder)
  { label: 'Calendar', href: '/calendar' },  // (placeholder)
  { label: 'Settings', href: '/settings' },  // (placeholder)
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">Navigation</div>
        <nav className="mt-2 space-y-1">
          {nav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
