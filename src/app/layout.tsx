import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SolarSense Egypt · PV Forecasting, 3D Digital Twin & Decision Platform',
  description:
    'Open, reproducible Egyptian solar photovoltaic forecasting benchmark (ERA5 → pvlib → XGBoost/LSTM/PGNN) and interactive Plan & Operate decision platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#05070f] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

