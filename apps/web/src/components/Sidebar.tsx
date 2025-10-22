'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { label: 'Clients',   href: '/clients' },
  { label: 'Cases',     href: '/cases' },
  { label: 'Documents', href: '/documents' },
  { label: 'Calendar',  href: '/calendar' },
  { label: 'Settings',  href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block shrink-0 border-r border-slate-200 bg-white w-[240px]">
      {/* Pegada bajo el topbar (56px) y con scroll propio */}
      <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto p-4">
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
