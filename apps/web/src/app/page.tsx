'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Client = { id: string; name: string; created_at: string; tags?: string[] };
const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Page() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchClients(query?: string) {
    const url = query?.trim() ? `${API}/v1/clients?q=${encodeURIComponent(query)}` : `${API}/v1/clients`;
    const res = await fetch(url);
    const json = await res.json() as { items: Client[] };
    setItems(json.items || []);
  }
  useEffect(() => { fetchClients(); }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <h1 className="text-3xl font-semibold">NovaFolio</h1>
      <form onSubmit={(e)=>{e.preventDefault(); fetchClients(q);}} className="flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" value={q} onChange={(e)=>setQ(e.target.value)} placeholder='Type "fu"…'/>
        <button className="rounded-md border px-4 py-2">Search</button>
      </form>

      <section className="space-y-2">
        {items.map(c => (
          <Link key={c.id} href={`/client/${c.id}`} className="block rounded-md border p-3 hover:bg-neutral-50">
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
          </Link>
        ))}
        {items.length===0 && <p className="text-sm text-gray-500">No results.</p>}
      </section>
    </main>
  );
}
