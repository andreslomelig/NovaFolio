'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Client = { id: string; name: string; created_at: string; tags?: string[] };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');

  async function load(query?: string) {
    setLoading(true);
    const url = query?.trim() ? `${API}/v1/clients?q=${encodeURIComponent(query)}` : `${API}/v1/clients`;
    const res = await fetch(url);
    const json = await res.json() as { items: Client[] };
    setItems(json.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch(`${API}/v1/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      })
    });
    if (res.ok) {
      setName(''); setTags('');
      await load(q);
    }
  }

  return (
    <div className="container-page space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search card */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div className="text-sm font-semibold text-slate-800">Search clients</div>
            <p className="help mt-1">Type a name or prefix (e.g. “fu” → Fulanito).</p>
          </div>
          <div className="card-body">
            <form
              onSubmit={(e)=>{ e.preventDefault(); load(q); }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input className="input" placeholder='Search…' value={q} onChange={(e)=>setQ(e.target.value)} />
              <button className="btn btn-primary" disabled={loading}>
                {loading ? 'Searching…' : 'Search'}
              </button>
            </form>

            <div className="mt-5 divide-y divide-slate-200 rounded-md border border-slate-200">
              {items.map(c => (
                <Link key={c.id} href={`/client/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="font-medium">{c.name}</div>
                  <div className="help">Created {new Date(c.created_at).toLocaleString()}</div>
                </Link>
              ))}
              {items.length === 0 && (
                <div className="p-4 help">No results.</div>
              )}
            </div>
          </div>
        </div>

        {/* Create card */}
        <div className="card">
          <div className="card-header">
            <div className="text-sm font-semibold text-slate-800">Add a new client</div>
            <p className="help mt-1">Minimal info now; you can add details later.</p>
          </div>
          <div className="card-body">
            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <label className="label">Client name</label>
                <input className="input mt-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="label">Tags <span className="help">(comma separated)</span></label>
                <input className="input mt-1" value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="vip, mexico, real-estate" />
              </div>
              <button className="btn btn-primary w-full">Create client</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
