'use client';

import Link from 'next/link';

export default function Topbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
        <Link href="/clients" className="text-lg font-semibold tracking-tight text-slate-900">
          NovaFolio
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/clients" className="btn">Clients</Link>
          <Link href="/clients/new" className="btn btn-primary">Add client</Link>
        </div>
      </div>
    </header>
  );
}
