'use client';

import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

export default function RpvViewer({
  fileUrl,
  initialQuery = '',
  initialPage,                
}: {
  fileUrl: string;
  initialQuery?: string;
  initialPage?: number;
}) {
  const search = searchPlugin({
    keyword: initialQuery ? [initialQuery] : [],
    highlightAll: true,
  });
  const defaultLayout = defaultLayoutPlugin();
  const nav = pageNavigationPlugin();
  const { jumpToPage } = nav;

  return (
    <div style={{ height: '78vh', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={fileUrl}
          plugins={[defaultLayout, search, nav]}
          theme="light"
          onDocumentLoad={() => {
            if (initialPage && initialPage > 0) jumpToPage(initialPage - 1);
          }}
        />
      </Worker>
    </div>
  );
}
