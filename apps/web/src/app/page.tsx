'use client';

import { useEffect, useState } from 'react';

type Client = { id: string; name: string; created_at: string; tags?: string[] };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Page() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [tags, setTags] = useState(''); // comma-separated

  async function fetchClients(query?: string) {
    setLoading(true);
    setError(null);
    try {
      const url = query && query.trim().length > 0
        ? `${API}/v1/clients?q=${encodeURIComponent(query)}`
        : `${API}/v1/clients`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json() as { items: Client[] };
      setItems(json.items || []);
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchClients(); }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await fetchClients(q);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const body = {
        name: name.trim(),
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      };
      const res = await fetch(`${API}/v1/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Create failed: ${res.status} ${txt}`);
      }
      setName('');
      setTags('');
      await fetchClients(q);
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">NovaFolio</h1>
        <p className="text-sm text-gray-500">Manage clients quickly. Try searching <code>fu</code>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Create client</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name"
          />
          <input
            className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (comma separated)"
          />
          <button
            type="submit"
            className="rounded-md border px-4 py-2"
          >
            Create
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Search</h2>
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Type a name or prefix (e.g., "fu")'
          />
          <button className="rounded-md border px-4 py-2" type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
      </section>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="font-medium">{c.name}</div>
            {c.tags && c.tags.length > 0 && (
              <div className="text-xs text-gray-600">tags: {c.tags.join(", ")}</div>
            )}
            <div className="text-xs text-gray-500">
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500">No results.</p>
        )}
      </section>
    </main>
  );
}
