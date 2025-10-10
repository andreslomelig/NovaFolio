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

  // Inline edit state
  const [editingId, setEditingId] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [busyId, setBusyId] = useState<string>(''); // para deshabilitar botones por doc

  async function loadCases() {
    try {
      const res = await fetch(`${API}/v1/cases?client_id=${clientId}`);
      if (!res.ok) throw new Error('Cannot load cases');
      const json = await res.json() as { items: Case[] };
      setCases(json.items || []);
      if (!selectedCase && json.items?.[0]) setSelectedCase(json.items[0].id);
    } catch (e:any) {
      setError(e.message || 'Cannot load cases');
    }
  }

  async function loadDocs(caseId: string) {
    if (!caseId) { setDocs([]); return; }
    try {
      const res = await fetch(`${API}/v1/documents?case_id=${encodeURIComponent(caseId)}`);
      if (res.status === 404) { setDocs([]); return; } // case_not_found → degrada a lista vacía
      if (!res.ok) {
        const msg = await res.text();
        console.error('loadDocs failed:', res.status, msg);
        setError(`Cannot load documents (${res.status})`);
        return;
      }
      const json = await res.json() as { items: Doc[] };
      setDocs(json.items || []);
    } catch (e:any) {
      console.error('loadDocs exception:', e);
      setError('Cannot load documents');
    }
  }

  useEffect(() => { loadCases(); /* eslint-disable-next-line */ }, [clientId]);
  useEffect(() => { if (selectedCase) loadDocs(selectedCase); /* eslint-disable-next-line */ }, [selectedCase]);

  async function createCase(e: React.FormEvent) {
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
      await loadCases();
    } catch (e:any) {
      setError(e.message || 'Create case failed');
    }
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedCase) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.append('case_id', selectedCase);
      fd.append('file', file);
      const res = await fetch(`${API}/v1/documents/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      setFile(null);
      (e.target as HTMLFormElement).reset();
      await loadDocs(selectedCase);
    } catch (e:any) {
      setError(e.message || 'Upload failed');
    }
  }

  // --- Acciones inline: Rename/Delete ---
  function startRename(doc: Doc) {
    setEditingId(doc.id);
    setEditingName(doc.name);
  }
  function cancelRename() {
    setEditingId('');
    setEditingName('');
  }
  async function saveRename(docId: string) {
    if (!editingName.trim()) return;
    setBusyId(docId); setError(null);
    try {
      const res = await fetch(`${API}/v1/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);
      setEditingId(''); setEditingName('');
      await loadDocs(selectedCase);
    } catch (e:any) {
      setError(e.message || 'Rename failed');
    } finally {
      setBusyId('');
    }
  }
  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setBusyId(docId); setError(null);
    try {
      const res = await fetch(`${API}/v1/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await loadDocs(selectedCase);
    } catch (e:any) {
      setError(e.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <h1 className="text-2xl font-semibold">Client</h1>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

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

      {/* Selección de casos */}
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

      {/* Lista con acciones inline */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Documents</h2>
        {docs.map(d => (
          <div key={d.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              {editingId === d.id ? (
                <input
                  className="rounded-md border px-2 py-1 w-64"
                  value={editingName}
                  onChange={(e)=>setEditingName(e.target.value)}
                />
              ) : (
                <>
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString()}</div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {editingId === d.id ? (
                <>
                  <button
                    className="rounded-md border px-3 py-1 text-sm"
                    disabled={busyId === d.id}
                    onClick={() => saveRename(d.id)}
                  >
                    Save
                  </button>
                  <button
                    className="rounded-md border px-3 py-1 text-sm"
                    onClick={cancelRename}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <a className="text-sm underline" href={`/doc/${d.id}`}>View</a>
                  <a className="text-sm underline" href={`${API}${d.storage_url}`} target="_blank" rel="noreferrer">Open</a>
                  <button className="text-sm underline" onClick={() => startRename(d)}>Rename</button>
                  <button
                    className="text-sm underline text-red-600"
                    disabled={busyId === d.id}
                    onClick={() => deleteDoc(d.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {docs.length===0 && <p className="text-sm text-gray-500">No documents.</p>}
      </section>
    </main>
  );
}
