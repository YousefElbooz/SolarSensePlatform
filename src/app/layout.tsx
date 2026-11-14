import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/Navbar';

export const metadata: Metadata = {
  title: {
    default: 'SolarSense Egypt · Solar forecasting and digital twin',
    template: '%s · SolarSense Egypt',
  },
  description:
    'Plan and simulate rooftop and ground solar in Egypt: a 3D digital twin of a PV site and a photovoltaic power forecast built on ERA5 weather data.',
  applicationName: 'SolarSense Egypt',
};

export const viewport: Viewport = {
  themeColor: '#060810',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--night)] text-[var(--ink)] antialiased selection:bg-[#f5a524] selection:text-[#1a1100]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
