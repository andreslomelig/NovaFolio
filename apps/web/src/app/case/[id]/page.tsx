'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

type CaseRec = { id: string; client_id: string; title: string; status: 'open'|'closed'; created_at: string };
type Client  = { id: string; name: string };
type Doc     = { id: string; name: string; mime: string; storage_url: string; created_at: string };

type SearchHit = {
  doc_id: string;
  page: number;
  snippet: string;
  doc_name: string;
  case_id: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const caseId = params.id;
  const clientFromQuery = sp.get('client') || '';

  const [rec, setRec] = useState<CaseRec | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  // status editor
  const [status, setStatus] = useState<'open'|'closed'>('open');
  const [savingStatus, setSavingStatus] = useState(false);

  // file search + list + upload
  const [q, setQ] = useState('');              // búsqueda por nombre de archivo
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // inline rename/delete
  const [editingId, setEditingId] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [busyId, setBusyId] = useState<string>('');

  // delete case
  const [deletingCase, setDeletingCase] = useState(false);

  // errores generales
  const [error, setError] = useState<string | null>(null);

  // ---------- NUEVO: BÚSQUEDA DE CONTENIDO EN EL CASO ----------
  const [qContent, setQContent] = useState('');                // búsqueda de texto dentro de los documentos
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loadingHits, setLoadingHits] = useState(false);
  const [errHits, setErrHits] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      // Cargar caso
      const r = await fetch(`${API}/v1/cases/${caseId}`).catch(()=>null);
      if (r?.ok) {
        const j = await r.json() as CaseRec;
        setRec(j);
        setStatus(j.status);
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

  // Cambiar estado del caso
  async function saveStatus(newStatus: 'open'|'closed') {
    setSavingStatus(true); setError(null);
    try {
      const res = await fetch(`${API}/v1/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(`Status update failed (${res.status})`);
      setStatus(newStatus);
    } catch (e:any) {
      setError(e.message || 'Status update failed');
    } finally {
      setSavingStatus(false);
    }
  }

  // Subir archivo
  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('case_id', caseId);
      fd.append('file', file);
      const res = await fetch(`${API}/v1/documents/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      setFile(null);
      (e.target as HTMLFormElement).reset();
      await loadDocs(q);
    } catch (err:any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // Borrar caso
  async function deleteCase() {
    if (!rec) return;
    if (!confirm(`Delete case "${rec.title}" and all its documents? This cannot be undone.`)) return;
    setDeletingCase(true);
    try {
      const res = await fetch(`${API}/v1/cases/${caseId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      if (client) router.push(`/client/${client.id}`);
      else router.push('/clients');
    } catch (e:any) {
      setError(e.message || 'Delete failed');
    } finally {
      setDeletingCase(false);
    }
  }

  // Renombrar
  function startRename(d: Doc) {
    setEditingId(d.id);
    setEditingName(d.name);
  }
  function cancelRename() {
    setEditingId('');
    setEditingName('');
  }
  async function saveRename(id: string) {
    if (!editingName.trim()) return;
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`${API}/v1/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);
      setEditingId(''); setEditingName('');
      await loadDocs(q);
    } catch (e:any) {
      setError(e.message || 'Rename failed');
    } finally {
      setBusyId('');   // liberar fila
    }
  }

  // Borrar documento
  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`${API}/v1/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await loadDocs(q);
    } catch (e:any) {
      setError(e.message || 'Delete failed');
    } finally {
      setBusyId('');   // liberar fila
    }
  }

  // ---------- NUEVO: buscar dentro del caso (contenido) ----------
  async function searchContent() {
    if (!qContent.trim()) { setHits([]); return; }
    setLoadingHits(true); setErrHits(null);
    try {
      const url = `${API}/v1/search?q=${encodeURIComponent(qContent)}&case_id=${encodeURIComponent(caseId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const j = await res.json() as { items: SearchHit[] };
      setHits(j.items || []);
    } catch (e:any) {
      setErrHits(e.message || 'Search failed');
    } finally {
      setLoadingHits(false);
    }
  }

  return (
    <div className="container-page space-y-6">
      {/* Header + breadcrumb + status control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{rec?.title ?? 'Case'}</h1>
          <p className="help mt-1">Manage files for this case.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e)=>saveStatus(e.target.value as 'open'|'closed')}
            disabled={savingStatus}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>

          {client && <Link href={`/client/${client.id}`} className="btn">Back to {client.name}</Link>}
          <Link href="/clients" className="btn">Clients</Link>
          <button
            className="btn btn-danger"
            onClick={deleteCase}
            disabled={deletingCase}
          >
            {deletingCase ? 'Deleting…' : 'Delete case'}
          </button>
        </div>
      </div>

      {/* -------- Búsqueda de contenido (caso) -------- */}
      <section className="card">
        <div className="card-header">
          <div className="text-sm font-semibold">Search inside this case</div>
          <p className="help mt-1">Search text across all documents in this case. Click to open at the right page.</p>
        </div>
        <div className="card-body">
          <form
            onSubmit={(e)=>{ e.preventDefault(); searchContent(); }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              className="input"
              placeholder="Find text across documents…"
              value={qContent}
              onChange={(e)=>setQContent(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" disabled={loadingHits}>
                {loadingHits ? 'Searching…' : 'Search'}
              </button>
              {errHits && <span className="text-xs text-rose-600">{errHits}</span>}
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {hits.map((h, i) => (
              <div key={`${h.doc_id}-${h.page}-${i}`} className="rounded border p-3 text-sm flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{h.doc_name} — page {h.page}</div>
                  <div className="text-xs text-slate-600">
                    {h.snippet?.replace(/\s+/g,' ').slice(0,180)}…
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    router.push(
                      `/doc/${h.doc_id}?case=${caseId}&q=${encodeURIComponent(qContent)}&page=${h.page}`
                    )
                  }
                >
                  Open
                </button>
              </div>
            ))}
            {!loadingHits && hits.length === 0 && qContent && (
              <div className="text-xs text-slate-500">No results</div>
            )}
          </div>
        </div>
      </section>

      {/* -------- Search by filename + Upload + List -------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search files + list */}
        <section className="card lg:col-span-2">
          <div className="card-header">
            <div className="text-sm font-semibold">Search files</div>
            <p className="help mt-1">Filter by file name. Click a file to view.</p>
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
                        <button
                          className="btn"
                          onClick={() => saveRename(d.id)}
                          disabled={busyId === d.id}
                        >
                          {busyId === d.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          className="btn"
                          onClick={cancelRename}
                          disabled={busyId === d.id}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Ver en el visor (incluye case param como fallback) */}
                        <Link className="link-action" href={`/doc/${d.id}?case=${caseId}`}>View</Link>

                        {/* Abrir el archivo crudo en nueva pestaña */}
                        <a className="link-action" href={`${API}${d.storage_url}`} target="_blank" rel="noreferrer">Open</a>

                        {/* Renombrar */}
                        <button
                          className="link-action"
                          onClick={() => startRename(d)}
                          disabled={busyId === d.id}
                        >
                          Rename
                        </button>

                        {/* Borrar (destructivo) */}
                        <button
                          className="btn btn-danger"
                          title="Delete file"
                          onClick={() => deleteDoc(d.id)}
                          disabled={busyId === d.id}
                        >
                          {busyId === d.id ? 'Deleting…' : 'Delete'}
                        </button>
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
            <p className="help mt-1">PDF and DOCX supported.</p>
          </div>
          <div className="card-body">
            <form onSubmit={uploadDoc} className="space-y-3">
              <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e)=>setFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <label htmlFor="file-input" className="btn">
                  {file ? 'Choose another file' : 'Choose file'}
                </label>
                {file && <div className="mt-2 text-sm text-slate-700">Selected: <strong>{file.name}</strong></div>}
                <p className="help mt-1">Max 25MB.</p>
              </div>
              <button className="btn btn-primary" disabled={!file || uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
