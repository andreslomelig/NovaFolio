'use client';

import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

export default function RpvViewer({
  fileUrl,
  initialQuery = '',
}: {
  fileUrl: string;
  initialQuery?: string;
}) {
  // Pre-highlight the initial query
  const search = searchPlugin({
    keyword: initialQuery ? [initialQuery] : [],
    highlightAll: true,
  });

  // Full toolbar, thumbnails, sidebar, search box, etc.
  const defaultLayout = defaultLayoutPlugin();

  return (
    <div style={{ height: '78vh', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={fileUrl} plugins={[defaultLayout, search]} theme="light" />
      </Worker>
    </div>
  );
}
