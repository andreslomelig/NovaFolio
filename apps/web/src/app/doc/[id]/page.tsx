'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });


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
  const sp = useSearchParams();                 // <-- AHORA DENTRO DEL COMPONENTE

  const docId = params.id;
  const caseId = sp.get('case') || '';          // <-- usamos el query param ?case=

  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      // 1) Intento por ID
      let res = await fetch(`${API}/v1/documents/${docId}`);
      if (res.ok) {
        setDoc(await res.json() as DocMeta);
        return;
      }
      // 2) Fallback por case_id si hubo 404
      if (res.status === 404 && caseId) {
        const list = await fetch(`${API}/v1/documents?case_id=${encodeURIComponent(caseId)}`);
        if (list.ok) {
          const j = await list.json() as { items: DocMeta[] };
          const found = (j.items || []).find(x => x.id === docId);
          if (found) { setDoc(found); return; }
        }
      }
      setError(`Failed to load (${res.status})`);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [docId, caseId]);

  const fileUrl = doc ? `${API}${doc.storage_url}` : '';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{doc?.name ?? 'Document'}</h1>
        <button onClick={() => router.back()} className="rounded-md border px-3 py-1 text-sm">Back</button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {doc && <PdfViewer url={fileUrl} />}
      {!doc && !error && <p className="text-sm text-gray-500">Loading…</p>}
    </main>
  );
}
