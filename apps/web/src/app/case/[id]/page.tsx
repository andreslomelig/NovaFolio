'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

type CaseRec = { id: string; client_id: string; title: string; status: string; created_at: string };
type Client = { id: string; name: string };
type Doc  = { id: string; name: string; mime: string; storage_url: string; created_at: string };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const caseId = params.id;
  const clientFromQuery = sp.get('client') || '';

  const [rec, setRec] = useState<CaseRec | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  const [q, setQ] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [busyId, setBusyId] = useState<string>('');

  useEffect(() => {
    (async () => {
      setError(null);
      const r = await fetch(`${API}/v1/cases/${caseId}`).catch(()=>null);
      if (r?.ok) {
        const j = await r.json() as CaseRec;
        setRec(j);
        // load client name for breadcrumb
        const cid = j.client_id || clientFromQuery;
        if (cid) {
          const rc = await fetch(`${API}/v1/clients/${cid}`).catch(()=>null);
          if (rc?.ok) {
            const c = await rc.json();
            setClient({ id: c.id, name: c.name });
          }
        }
      } else {
        setError(`Case not found (${r?.status})`);
      }
      await loadDocs(q);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function loadDocs(query?: string) {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const url = query?.trim()
        ? `${API}/v1/documents?case_id=${caseId}&q=${encodeURIComponent(query)}`
        : `${API}/v1/documents?case_id=${caseId}`;
      const res = await fetch(url);
      if (res.status === 404) { setDocs([]); return; }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const json = await res.json() as { items: Doc[] };
      setDocs(json.items || []);
    } catch (e:any) {
      setError(e.message || 'Cannot load documents');
    } finally {
      setLoading(false);
    }
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append('case_id', caseId);
    fd.append('file', file);
    const res = await fetch(`${API}/v1/documents/upload`, { method: 'POST', body: fd });
    if (!res.ok) { setError('Upload failed'); return; }
    setFile(null);
    (e.target as HTMLFormElement).reset();
    await loadDocs(q);
  }

  function startRename(d: Doc) { setEditingId(d.id); setEditingName(d.name); }
  function cancelRename() { setEditingId(''); setEditingName(''); }
  async function saveRename(id: string) {
    if (!editingName.trim()) return;
    setBusyId(id);
    const res = await fetch(`${API}/v1/documents/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName.trim() })
    });
    setBusyId('');
    if (!res.ok) { setError(`Rename failed (${res.status})`); return; }
    setEditingId(''); setEditingName('');
    await loadDocs(q);
  }
  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    setBusyId(id);
    const res = await fetch(`${API}/v1/documents/${id}`, { method: 'DELETE' });
    setBusyId('');
    if (!res.ok) { setError(`Delete failed (${res.status})`); return; }
    await loadDocs(q);
  }

  return (
    <div className="container-page space-y-6">
      {/* Header + breadcrumb */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{rec?.title ?? 'Case'}</h1>
          <p className="help mt-1">Status: {rec?.status ?? '-'}</p>
        </div>
        <div className="flex items-center gap-2">
          {client && <Link href={`/client/${client.id}`} className="btn">Back to {client.name}</Link>}
          <Link href="/clients" className="btn">Clients</Link>
        </div>
      </div>

      {/* Search + Upload + List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search files */}
        <section className="card lg:col-span-2">
          <div className="card-header">
            <div className="text-sm font-semibold">Search files</div>
            <p className="help mt-1">Filter by file name.</p>
          </div>
          <div className="card-body">
            <form onSubmit={(e)=>{e.preventDefault(); loadDocs(q);}} className="flex flex-col gap-2 sm:flex-row">
              <input className="input" placeholder="Search documents…" value={q} onChange={(e)=>setQ(e.target.value)} />
              <button className="btn btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
            </form>

            <div className="mt-5 divide-y divide-slate-200 rounded-md border border-slate-200">
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    {editingId === d.id ? (
                      <input className="input w-80" value={editingName} onChange={(e)=>setEditingName(e.target.value)} />
                    ) : (
                      <>
                        <div className="font-medium truncate">{d.name}</div>
                        <div className="help">{new Date(d.created_at).toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {editingId === d.id ? (
                      <>
                        <button className="btn" onClick={() => saveRename(d.id)} disabled={busyId===d.id}>Save</button>
                        <button className="btn" onClick={cancelRename}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <Link className="text-sm text-blue-700 underline" href={`/doc/${d.id}?case=${caseId}`}>View</Link>
                        <a className="text-sm underline" href={`${API}${d.storage_url}`} target="_blank" rel="noreferrer">Open</a>
                        <button className="text-sm underline" onClick={() => startRename(d)}>Rename</button>
                        <button className="text-sm underline text-rose-600" onClick={() => deleteDoc(d.id)} disabled={busyId===d.id}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {docs.length === 0 && <div className="p-4 help">No documents yet.</div>}
            </div>

            {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          </div>
        </section>

        {/* Upload */}
        <section className="card">
          <div className="card-header">
            <div className="text-sm font-semibold">Upload files</div>
            <p className="help mt-1">PDF only (demo). Drag & drop coming soon.</p>
          </div>
          <div className="card-body">
            <form onSubmit={uploadDoc} className="space-y-2">
              <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
                <p className="help mt-1">Max 25MB (demo).</p>
              </div>
              <button className="btn btn-primary" disabled={!file}>Upload</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
