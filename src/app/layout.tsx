import type { Metadata } from 'next';
import {
  Fraunces,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/Navbar';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SolarSense Egypt · PV Forecasting, 3D Digital Twin & Decision Platform',
  description:
    'Cinematic Egyptian solar photovoltaic planning, 3D digital twin, and physics-guided forecasting platform (ERA5 → pvlib → XGBoost / LSTM / PGNN).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${jakarta.variable} ${jetbrainsMono.variable} ${ibmPlexArabic.variable}`}
    >
      <body className="min-h-screen bg-[#05070f] text-[#f4f5fa] antialiased selection:bg-[#f5a524] selection:text-[#1a1100]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
