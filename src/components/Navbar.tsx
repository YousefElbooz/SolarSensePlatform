'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun,
  Layers,
  Globe2,
  Box,
  FileSpreadsheet,
  Activity,
  BarChart3,
  Bot,
  Info,
  Languages,
} from 'lucide-react';

type Lang = 'en' | 'ar';

interface LangContextValue {
  lang: Lang;
  isAr: boolean;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  isAr: false,
  toggleLang: () => {},
});

export function useLanguage() {
  return useContext(LangContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('solarsense_lang') as Lang | null;
    if (saved === 'ar' || saved === 'en') {
      setLang(saved);
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = saved;
    }
  }, []);

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'ar' : 'en';
    setLang(next);
    localStorage.setItem('solarsense_lang', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <LangContext.Provider value={{ lang, isAr: lang === 'ar', toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function Navbar({ clockLabel }: { clockLabel?: string }) {
  const pathname = usePathname();
  const { isAr, toggleLang } = useLanguage();

  const links = [
    { href: '/', labelEn: 'Plan (Day Arc)', labelAr: 'خطط (مسار الشمس)', icon: Sun },
    { href: '/panels', labelEn: '3D Panels', labelAr: 'الألواح 3D', icon: Layers },
    { href: '/regions', labelEn: '4 Regions', labelAr: 'الأقاليم الأربعة', icon: Globe2 },
    { href: '/twin', labelEn: 'Digital Twin', labelAr: 'التوأم الرقمي', icon: Box },
    { href: '/report/demo', labelEn: 'Report', labelAr: 'التقرير المالي', icon: FileSpreadsheet },
    { href: '/app', labelEn: 'Operate', labelAr: 'التشغيل', icon: Activity },
    { href: '/app/models', labelEn: 'Benchmark', labelAr: 'مقارنة النماذج', icon: BarChart3 },
    { href: '/app/assistant', labelEn: 'AI Assistant', labelAr: 'المساعد الذكي', icon: Bot },
    { href: '/about', labelEn: 'About', labelAr: 'المنهجية', icon: Info },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-[#05070f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-serif text-lg font-semibold tracking-tight text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/40">
                <Sun className="h-4 w-4" />
              </span>
              <span>SolarSense</span>
              <span className="hidden rounded-full bg-teal-500/15 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-widest text-teal-300 sm:inline-block">
                Egypt
              </span>
            </Link>
            {clockLabel && (
              <span className="hidden shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-wider text-amber-300 xl:inline-block">
                {clockLabel}
              </span>
            )}
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto py-0.5 text-xs">
            {links.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 transition ${
                    active
                      ? 'bg-amber-500 font-semibold text-slate-950 shadow-sm shadow-amber-500/30'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? item.labelAr : item.labelEn}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:text-white"
              title="Switch Language (English / العربية)"
            >
              <Languages className="h-3.5 w-3.5 text-amber-400" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
          </div>
        </div>
      </header>
      {pathname !== '/' && <div className="h-14" />}
    </>
  );
}
