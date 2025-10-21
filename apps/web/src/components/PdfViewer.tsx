'use client';

import { useEffect, useRef, useState } from 'react';

type PDFDocumentProxy = any;

type Highlight = {
  page: number;
  x: number;
  y: number;      // top en px (coordenadas CSS)
  width: number;
  height: number;
};

export default function PdfViewer({ url, initialQuery = '' }: { url: string; initialQuery?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfjsRef = useRef<any>(null); // guardamos el módulo pdfjs para usar Util.transform
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // búsqueda
  const [q, setQ] = useState(initialQuery);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [canvasSize, setCanvasSize] = useState<{w:number; h:number}>({ w: 0, h: 0 });

  // Carga pdf.js (UMD) y configura worker con fallback
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const mod: any = await import('pdfjs-dist/build/pdf'); // UMD estable en v3.x
      const pdfjs = mod && mod.default ? mod.default : mod;
      pdfjsRef.current = pdfjs;

      // Intenta usar el worker .js de /public; si no existe, usa main-thread
      try {
        const head = await fetch('/pdf.worker.min.js', { method: 'HEAD' });
        if (!head.ok) throw new Error('worker not found');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      } catch {
        (pdfjs as any).disableWorker = true;
        console.warn('Worker not found, rendering on main thread (dev fallback).');
      }

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

  // Render de la página (canvas)
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

      setCanvasSize({ w: viewport.width, h: viewport.height });

      renderTask = p.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch {}
    };
  }, [pdf, page, scale]);

  // --- BÚSQUEDA + HIGHLIGHTS ---
  async function runSearch(query: string) {
    if (!pdf || !pdfjsRef.current) {
      setHighlights([]);
      return;
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      setHighlights([]);
      return;
    }

    const results: Highlight[] = [];
    // Recorremos todas las páginas (MVP)
    for (let pg = 1; pg <= pdf.numPages; pg++) {
      const p = await pdf.getPage(pg);
      const viewport = p.getViewport({ scale });
      const text = await p.getTextContent();
      const Util = pdfjsRef.current.Util;

      for (const item of (text.items as any[])) {
        const str: string = (item.str || '').toLowerCase();
        if (!str) continue;
        const idx = str.indexOf(needle);
        if (idx < 0) continue;

        // Posicionamiento del run completo (simple y robusto para demo)
        const tr: number[] = Util.transform(viewport.transform, item.transform);
        const x = tr[4];                            // x en coords viewport
        const y_pdf = tr[5];                        // y PDF (bottom-left)
        const h = Math.hypot(tr[2], tr[3]);         // altura de fuente resultante
        const w = (item.width || 0) * viewport.scale; // ancho aprox del run completo

        // Convertimos y a top-left CSS: top = viewport.height - y_pdf - h
        const top = viewport.height - y_pdf - h;

        results.push({ page: pg, x, y: top, width: w, height: h });
      }
    }

    setHighlights(results);
    if (results[0]) setPage(results[0].page);
  }

  // Recalcula highlights cuando cambia escala o q
  useEffect(() => {
    if (!pdf) return;
    // re-ejecuta búsqueda con la escala actual (para que los rects escalen)
    if (q.trim()) runSearch(q);
    else setHighlights([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, scale]);

  // UI
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

        {/* buscador */}
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(q); }}
          className="ml-4 flex items-center gap-2"
        >
          <input
            className="rounded-md border px-2 py-1 text-sm"
            placeholder="Find text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 200 }}
          />
          <button className="rounded border px-2 py-1 text-sm">Find</button>
        </form>

        {loading && <span className="text-xs text-gray-500 ml-4">Loading…</span>}
        {error && <span className="text-xs text-red-600 ml-4">{error}</span>}
      </div>

      {/* Contenedor con overlay de highlights */}
      <div className="border rounded overflow-auto" style={{ maxHeight: '80vh' }}>
        <div style={{ position: 'relative', width: canvasSize.w, height: canvasSize.h }}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
          <div
            className="pointer-events-none"
            style={{ position: 'absolute', left: 0, top: 0, width: canvasSize.w, height: canvasSize.h }}
          >
            {highlights.filter(h => h.page === page).map((h, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: h.x,
                  top: h.y,
                  width: h.width,
                  height: h.height,
                  background: 'rgba(255, 230, 0, 0.35)',
                  outline: '1px solid rgba(255, 200, 0, 0.9)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
