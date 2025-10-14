'use client';

import { useEffect, useRef, useState } from 'react';

type PDFDocumentProxy = any;

export default function PdfViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga pdf.js (UMD) y configura worker con fallback
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const mod: any = await import('pdfjs-dist/build/pdf'); // UMD estable en v3.x
      const pdfjs = mod && mod.default ? mod.default : mod;

      // Intenta usar el worker .js de /public; si no existe, usa main-thread
      try {
        // HEAD para verificar que exista el worker
        const head = await fetch('/pdf.worker.min.js', { method: 'HEAD' });
        if (!head.ok) throw new Error('worker not found');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      } catch (e) {
        console.warn('Worker not available, falling back to main-thread rendering:', e);
        (pdfjs as any).disableWorker = true;
      }

      // Carga del PDF (CORS ok; tu API tiene @fastify/cors habilitado)
      const task = pdfjs.getDocument({ url, withCredentials: false });
      const doc = await task.promise;
      if (cancelled) return;

      setPdf(doc);
      setNumPages(doc.numPages);
      setPage(1);
    })()
      .catch((e: any) => {
        console.error('PDF load error:', e);
        setError('Failed to load PDF');
      })
      .finally(() => setLoading(false));

    return () => { cancelled = true; };
  }, [url]);

  // Render de la página
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;
    let renderTask: any;

    (async () => {
      const p = await pdf.getPage(page);
      const viewport = p.getViewport({ scale });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = p.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch {}
    };
  }, [pdf, page, scale]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="rounded border px-2 py-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
        <span className="text-sm">{page} / {numPages || '-'}</span>
        <button className="rounded border px-2 py-1" onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={!numPages || page >= numPages}>Next</button>

        <div className="ml-4" />
        <button className="rounded border px-2 py-1" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
        <span className="text-sm">Zoom</span>
        <button className="rounded border px-2 py-1" onClick={() => setScale(s => Math.min(3, s + 0.1))}>+</button>
        <button className="rounded border px-2 py-1 ml-2" onClick={() => setScale(1.2)}>Reset</button>

        {loading && <span className="text-xs text-gray-500 ml-4">Loading…</span>}
        {error && <span className="text-xs text-red-600 ml-4">{error}</span>}
      </div>

      <div className="border rounded overflow-auto" style={{ maxHeight: '80vh' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
