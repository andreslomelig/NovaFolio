'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const RpvViewer = dynamic(() => import('@/components/RpvViewer'), { ssr: false });

type DocMeta = {
  id: string;
  case_id: string;
  name: string;
  mime: string;
  storage_url: string;
  created_at: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function DocPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();

  const docId = params.id;
  const caseId = sp.get('case') || '';
  const initialQuery = sp.get('q') || '';

  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      let res = await fetch(`${API}/v1/documents/${docId}`);
      if (res.ok) {
        setDoc((await res.json()) as DocMeta);
        return;
      }
      if (res.status === 404 && caseId) {
        const list = await fetch(`${API}/v1/documents?case_id=${encodeURIComponent(caseId)}`);
        if (list.ok) {
          const j = (await list.json()) as { items: DocMeta[] };
          const found = (j.items || []).find((x) => x.id === docId);
          if (found) {
            setDoc(found);
            return;
          }
        }
      }
      setError(`Failed to load (${res.status})`);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, caseId]);

  const isPdf  = !!doc?.mime?.startsWith('application/pdf');
  const isDocx = doc?.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Same-origin proxy avoids CORS: /backend + storage_url
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const proxiedFileUrl = doc ? `${origin}/backend${doc.storage_url}` : '';

  const docxHtmlUrl = doc ? `${API}/v1/documents/${docId}/html` : '';
  const directFileUrl = doc ? `${API}${doc.storage_url}` : '';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{doc?.name ?? 'Document'}</h1>
        <div className="flex items-center gap-2">
          {!!doc && (
            <a className="btn" href={directFileUrl} target="_blank" rel="noreferrer">
              Open original
            </a>
          )}
          <button onClick={() => router.back()} className="btn">Back</button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* PDF via react-pdf-viewer */}
      {doc && isPdf && <RpvViewer fileUrl={proxiedFileUrl} initialQuery={initialQuery} />}

      {/* DOCX preview (same as before) */}
      {doc && isDocx && (
        <div className="card">
          <div className="card-header"><div className="text-sm font-semibold">DOCX preview</div></div>
          <div className="card-body">
            <iframe
              src={docxHtmlUrl}
              title={doc.name}
              style={{ width: '100%', height: '70vh', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
            <div className="mt-3">
              <a className="link-action" href={directFileUrl} target="_blank" rel="noreferrer">
                Download (.docx)
              </a>
            </div>
          </div>
        </div>
      )}

      {doc && !isPdf && !isDocx && (
        <div className="help">
          Unsupported preview.{' '}
          <a className="link-action" href={directFileUrl} target="_blank" rel="noreferrer">Download</a>
        </div>
      )}

      {!doc && !error && <p className="help">Loading…</p>}
    </main>
  );
}
