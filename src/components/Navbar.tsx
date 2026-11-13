'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

const NAV_LINKS = [
  { href: '/', labelEn: 'Day Arc', labelAr: 'مسار الشمس', shortEn: 'Plan', icon: Sun },
  { href: '/panels', labelEn: 'Panels', labelAr: 'الألواح', shortEn: 'Panels', icon: Layers },
  { href: '/regions', labelEn: 'Regions', labelAr: 'الأقاليم', shortEn: 'Regions', icon: Globe2 },
  { href: '/twin', labelEn: '3D Twin', labelAr: 'التوأم 3D', shortEn: 'Twin', icon: Box },
  { href: '/report/demo', labelEn: 'Report', labelAr: 'التقرير', shortEn: 'Report', icon: FileSpreadsheet },
  { href: '/app', labelEn: 'Operate', labelAr: 'التشغيل', shortEn: 'Operate', icon: Activity },
  { href: '/app/models', labelEn: 'Models', labelAr: 'النماذج', shortEn: 'Models', icon: BarChart3 },
  { href: '/app/assistant', labelEn: 'Assistant', labelAr: 'المساعد', shortEn: 'AI', icon: Bot },
  { href: '/about', labelEn: 'Methods', labelAr: 'المنهجية', shortEn: 'Methods', icon: Info },
] as const;

let routesPrefetchedOnce = false;

export function Navbar({ clockLabel }: { clockLabel?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAr, toggleLang } = useLanguage();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  // Clear optimistic tab indicator once pathname settles
  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  // Proactively prefetch all Navbar routes once during browser idle time so tab switching is instant
  useEffect(() => {
    if (routesPrefetchedOnce) return;
    routesPrefetchedOnce = true;

    const timer = setTimeout(() => {
      NAV_LINKS.forEach((item, index) => {
        setTimeout(() => {
          try {
            router.prefetch(item.href);
          } catch {
            // ignore prefetch errors
          }
        }, index * 60);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [router]);

  const currentPath = optimisticHref ?? pathname;

  return (
    <>
      {/* Scroll Edge Effect (liquid-glass.md › Review checklist #6): blurs content meeting the top bar without a solid bar background */}
      <div className="scroll-edge-top fixed top-0 left-0 right-0 z-30 h-20" aria-hidden="true" />

      <header className="fixed top-0 left-0 right-0 z-40">
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              prefetch={true}
              onMouseDown={() => setOptimisticHref('/')}
              className="group flex min-h-[38px] shrink-0 items-center gap-2.5 rounded-full pr-2 font-serif text-[19px] font-semibold tracking-tight text-white"
            >
              <span className="liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-[#ffd60a] transition-transform duration-200 group-hover:scale-105">
                <Sun className="h-4 w-4" />
              </span>
              <span>SolarSense</span>
            </Link>

            {/* Desktop Floating Liquid Glass Capsule Tab Bar (liquid-glass.md & tab-bars.md) */}
            <nav
              aria-label="Primary Navigation"
              className="liquid-glass hidden items-center gap-0.5 rounded-full p-1 lg:flex"
            >
              {NAV_LINKS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === '/'
                    ? currentPath === '/'
                    : currentPath === item.href || currentPath.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onMouseDown={() => setOptimisticHref(item.href)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[32px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] tracking-[-0.008em] transition-all duration-150 active:scale-[0.97] ${
                      active
                        ? 'bg-white/[0.14] font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.24)]'
                        : 'font-medium text-[#b4b8cb] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        active ? 'text-[#ffd60a]' : 'text-[#8e93a8]'
                      }`}
                    />
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={isAr ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
              className="liquid-glass flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-[#f5f5f7] transition hover:border-white/30 hover:text-white active:scale-[0.97]"
              title="Switch Language (English / العربية)"
            >
              <Languages className="h-3.5 w-3.5 text-[#ffd60a]" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>

            {clockLabel && (
              <div
                id="clock"
                aria-live="off"
                className="liquid-glass shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[12px] font-medium tracking-[0.06em] uppercase text-[#f5f5f7]"
              >
                {clockLabel}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Phone / Compact Floating Liquid Glass Bottom Tab Bar (tab-bars.md › Phone (iOS)) */}
      <nav
        aria-label="Mobile Navigation"
        className="liquid-glass fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between gap-1 overflow-x-auto rounded-full px-2 py-1.5 lg:hidden"
      >
        {NAV_LINKS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/'
              ? currentPath === '/'
              : currentPath === item.href || currentPath.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onMouseDown={() => setOptimisticHref(item.href)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[40px] min-w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1 text-[10.5px] transition-all active:scale-[0.96] ${
                active
                  ? 'bg-white/[0.15] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
                  : 'font-medium text-[#b4b8cb]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#ffd60a]' : 'text-[#8e93a8]'}`} />
              <span>{isAr ? item.labelAr : item.shortEn}</span>
            </Link>
          );
        })}
      </nav>

      {pathname !== '/' && <div className="h-16" />}
    </>
  );
}
