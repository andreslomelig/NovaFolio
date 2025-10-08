'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Case = { id: string; title: string; status: string; created_at: string };
type Doc  = { id: string; name: string; mime: string; storage_url: string; created_at: string };

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ClientProfile() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [cases, setCases] = useState<Case[]>([]);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('open');

  const [selectedCase, setSelectedCase] = useState<string>('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCases() {
    const res = await fetch(`${API}/v1/cases?client_id=${clientId}`);
    if (!res.ok) return setError('Cannot load cases');
    const json = await res.json() as { items: Case[] };
    setCases(json.items || []);
    if (!selectedCase && json.items?.[0]) setSelectedCase(json.items[0].id);
  }

  async function loadDocs(caseId: string) {
    if (!caseId) { setDocs([]); return; }
    try {
      const res = await fetch(`${API}/v1/documents?case_id=${encodeURIComponent(caseId)}`);
      if (res.status === 404) {
        // Caso no encontrado (p.ej., se eliminó en otra sesión). En UI, trátalo como "sin docs".
        setDocs([]);
        return;
      }
      if (!res.ok) {
        const msg = await res.text();
        console.error("loadDocs failed:", res.status, msg);
        setError(`Cannot load documents (${res.status})`);
        return;
      }
      const json = await res.json() as { items: Doc[] };
      setDocs(json.items || []);
    } catch (e: any) {
      console.error("loadDocs exception:", e);
      setError("Cannot load documents");
    }
  }


  useEffect(() => { loadCases(); }, [clientId]);
  useEffect(() => { if (selectedCase) loadDocs(selectedCase); }, [selectedCase]);

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <h1 className="text-2xl font-semibold">Client</h1>
      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Crear caso */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Create Case</h2>
        <form onSubmit={createCase} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="rounded-md border px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" />
          <select className="rounded-md border px-3 py-2" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
          <button className="rounded-md border px-4 py-2">Create</button>
        </form>
      </section>

      {/* Seleccionar caso */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cases</h2>
        <select className="rounded-md border px-3 py-2" value={selectedCase} onChange={(e)=>setSelectedCase(e.target.value)}>
          <option value="">-- select case --</option>
          {cases.map(k => <option key={k.id} value={k.id}>{k.title} ({k.status})</option>)}
        </select>
        <div className="text-xs text-gray-500">{cases.length} case(s)</div>
      </section>

      {/* Upload documento */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Upload PDF to selected case</h2>
        <form onSubmit={uploadDoc} className="flex items-center gap-2">
          <input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
          <button className="rounded-md border px-4 py-2" disabled={!selectedCase || !file}>Upload</button>
        </form>
      </section>

      {/* Lista documentos */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Documents</h2>
        {docs.map(d => (
          <div key={d.id} className="rounded-md border p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString()}</div>
            </div>
            <a className="text-sm underline" href={`${API}${d.storage_url}`} target="_blank">Open</a>
          </div>
        ))}
        {docs.length===0 && <p className="text-sm text-gray-500">No documents.</p>}
      </section>
    </main>
  );
}
