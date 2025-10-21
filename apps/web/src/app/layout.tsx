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
        {/* App chrome */}
        <Topbar />
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[240px,1fr]">
          {/* Sidebar sticks below the 56px topbar */}
          <Sidebar />
          {/* Main content fills viewport height minus topbar */}
          <main className="min-h-[calc(100vh-56px)] bg-slate-50">{children}</main>
        </div>
      </body>
    </html>
  );
}
