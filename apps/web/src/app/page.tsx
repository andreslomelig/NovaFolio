'use client';

import { useState } from 'react';

type Client = { id: string; name: string; created_at: string };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function Page() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/clients?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = (await res.json()) as { items: Client[] };
      setItems(json.items || []);
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">NovaFolio</h1>
      <p className="text-sm text-gray-500 mt-1">
        Búsqueda rápida por prefijo/parcial (prueba <code>fu</code>).
      </p>

      <form onSubmit={onSearch} className="mt-6 flex gap-2">
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Escribe un nombre… (ej. "fu")'
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border px-4 py-2 disabled:opacity-60"
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-gray-500">
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500">Sin resultados.</p>
        )}
      </div>
    </main>
  );
}
