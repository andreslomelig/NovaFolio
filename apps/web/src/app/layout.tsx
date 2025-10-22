import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'NovaFolio',
  description: 'Fast, clear document & case management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Topbar />
        {/* Shell principal: sidebar fija + main con overflow */}
        <div className="mx-auto flex w-full max-w-7xl">
          <Sidebar />
          <main className="min-w-0 flex-1 min-h-[calc(100vh-56px)] overflow-auto bg-slate-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
