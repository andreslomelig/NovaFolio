'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Client = { id: string; name: string };
type Case = { id: string; title: string; status: string; created_at: string };
type Doc  = { id: string; name: string; mime: string; storage_url: string; created_at: string };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ClientProfile() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create case form
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('open');

  // Upload
  const [file, setFile] = useState<File | null>(null);

  // Inline rename/delete
  const [editingId, setEditingId] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [busyId, setBusyId] = useState<string>('');

  useEffect(() => {
    (async () => {
      // client header
      const r = await fetch(`${API}/v1/clients/${clientId}`).catch(()=>null);
      if (r?.ok) {
        const j = await r.json();
        setClient({ id: j.id, name: j.name });
      }
      loadCases();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadCases() {
    try {
      const res = await fetch(`${API}/v1/cases?client_id=${clientId}`);
      if (!res.ok) throw new Error('Cannot load cases');
      const json = await res.json() as { items: Case[] };
      setCases(json.items || []);
      if (!selectedCase && json.items?.[0]?.id) setSelectedCase(json.items[0].id);
    } catch (e:any) {
      setError(e.message || 'Cannot load cases');
    }
  }

  async function loadDocs(caseId: string) {
    if (!caseId) { setDocs([]); return; }
    const res = await fetch(`${API}/v1/documents?case_id=${encodeURIComponent(caseId)}`);
    if (res.status === 404) { setDocs([]); return; }
    const json = await res.json() as { items: Doc[] };
    setDocs(json.items || []);
  }

  useEffect(() => { if (selectedCase) loadDocs(selectedCase); }, [selectedCase]);

  // Create case
  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API}/v1/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, title, status })
    });
    if (!res.ok) { setError('Create case failed'); return; }
    setTitle(''); setStatus('open');
    await loadCases();
  }

  // Upload
  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedCase) return;
    setError(null);
    const fd = new FormData();
    fd.append('case_id', selectedCase);
    fd.append('file', file);
    const res = await fetch(`${API}/v1/documents/upload`, { method: 'POST', body: fd });
    if (!res.ok) { setError('Upload failed'); return; }
    setFile(null);
    (e.target as HTMLFormElement).reset();
    await loadDocs(selectedCase);
  }

  // Rename/Delete inline
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
    await loadDocs(selectedCase);
  }
  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    setBusyId(id);
    const res = await fetch(`${API}/v1/documents/${id}`, { method: 'DELETE' });
    setBusyId('');
    if (!res.ok) { setError(`Delete failed (${res.status})`); return; }
    await loadDocs(selectedCase);
  }

  return (
    <div className="container-page space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client?.name ?? 'Client'}</h1>
          <p className="help mt-1">Manage cases and documents for this client.</p>
        </div>
        <Link href="/clients" className="btn">Back to list</Link>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Cases (search + create) */}
        <section className="card lg:col-span-1">
          <div className="card-header">
            <div className="text-sm font-semibold">Cases</div>
            <p className="help mt-1">Search and create cases for this client.</p>
          </div>
          <div className="card-body space-y-4">
            {/* Create case */}
            <form onSubmit={createCase} className="space-y-3">
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

            {/* Existing cases */}
            <div>
              <label className="label">Select a case</label>
              <select className="input mt-1" value={selectedCase} onChange={(e)=>setSelectedCase(e.target.value)}>
                <option value="">-- choose --</option>
                {cases.map(k => <option key={k.id} value={k.id}>{k.title} ({k.status})</option>)}
              </select>
              <p className="help mt-1">{cases.length} case(s)</p>
            </div>
          </div>
        </section>

        {/* Right column: Upload + Documents */}
        <section className="card lg:col-span-2">
          <div className="card-header">
            <div className="text-sm font-semibold">Documents</div>
            <p className="help mt-1">Step 1: select a case. Step 2: upload. Step 3: open/rename/delete.</p>
          </div>
          <div className="card-body space-y-5">
            {/* Upload area */}
            <form onSubmit={uploadDoc} className="space-y-2">
              <label className="label">Upload PDF</label>
              <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
                <p className="help mt-1">Max 25MB (demo). Only PDF for now.</p>
              </div>
              <button className="btn btn-primary" disabled={!selectedCase || !file}>Upload</button>
            </form>

            <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
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
                        <Link className="text-sm text-blue-700 underline" href={`/doc/${d.id}?case=${selectedCase}`}>View</Link>
                        <a className="text-sm underline" href={`${API}${d.storage_url}`} target="_blank" rel="noreferrer">Open</a>
                        <button className="text-sm underline" onClick={() => startRename(d)}>Rename</button>
                        <button className="text-sm underline text-rose-600" onClick={() => deleteDoc(d.id)} disabled={busyId===d.id}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {docs.length === 0 && (
                <div className="p-4 help">No documents for this case yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    </div>
  );
}
