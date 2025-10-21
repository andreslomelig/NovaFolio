'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Client = { id: string; name: string };
type Case = { id: string; title: string; status: string; created_at: string };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ClientCasesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  // create form
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/v1/clients/${clientId}`).catch(()=>null);
      if (r?.ok) {
        const j = await r.json();
        setClient({ id: j.id, name: j.name });
      }
      await loadCases();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadCases(query?: string) {
    setLoading(true);
    setError(null);
    try {
      const url = query?.trim()
        ? `${API}/v1/cases?client_id=${clientId}&q=${encodeURIComponent(query)}`
        : `${API}/v1/cases?client_id=${clientId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json() as { items: Case[] };
      setCases(json.items || []);
    } catch (e:any) {
      setError(e.message || 'Cannot load cases');
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API}/v1/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, title, status })
      });
      if (!res.ok) throw new Error('Create case failed');
      setTitle(''); setStatus('open');
      await loadCases(q);
    } catch (e:any) {
      setError(e.message || 'Create case failed');
    }
  }

  return (
    <div className="container-page space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client?.name ?? 'Client'}</h1>
          <p className="help mt-1">Search and manage cases for this client.</p>
        </div>
        <Link href="/clients" className="btn">Back to list</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search + list */}
        <section className="card lg:col-span-2">
          <div className="card-header">
            <div className="text-sm font-semibold">Search cases</div>
            <p className="help mt-1">Type a case title or prefix.</p>
          </div>
          <div className="card-body">
            <form
              onSubmit={(e)=>{ e.preventDefault(); loadCases(q); }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input className="input" placeholder="Search cases…" value={q} onChange={(e)=>setQ(e.target.value)} />
              <button className="btn btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
            </form>

            <div className="mt-5 divide-y divide-slate-200 rounded-md border border-slate-200">
              {cases.map(k => (
                <Link key={k.id} href={`/case/${k.id}?client=${clientId}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="font-medium">{k.title}</div>
                  <div className="help">
                    {k.status} • {new Date(k.created_at).toLocaleString()}
                  </div>
                </Link>
              ))}
              {cases.length === 0 && <div className="p-4 help">No cases yet.</div>}
            </div>

            {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          </div>
        </section>

        {/* Create case */}
        <section className="card">
          <div className="card-header">
            <div className="text-sm font-semibold">Add a new case</div>
            <p className="help mt-1">Title + status. You can edit later.</p>
          </div>
          <div className="card-body">
            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input mt-1" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g., Contract #24" />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input mt-1" value={status} onChange={(e)=>setStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <button className="btn btn-primary w-full">Create case</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
