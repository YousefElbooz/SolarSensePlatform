'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
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
  const headerRef = useRef<HTMLElement>(null);

  const links = [
    { href: '/', labelEn: 'Day Arc', labelAr: 'مسار الشمس', icon: Sun },
    { href: '/panels', labelEn: '3D Panels', labelAr: 'الألواح 3D', icon: Layers },
    { href: '/regions', labelEn: '4 Regions', labelAr: 'الأقاليم الأربعة', icon: Globe2 },
    { href: '/twin', labelEn: 'Digital Twin', labelAr: 'التوأم الرقمي', icon: Box },
    { href: '/report/demo', labelEn: 'Report', labelAr: 'التقرير المالي', icon: FileSpreadsheet },
    { href: '/app', labelEn: 'Operate', labelAr: 'التشغيل', icon: Activity },
    { href: '/app/models', labelEn: 'Benchmark', labelAr: 'مقارنة النماذج', icon: BarChart3 },
    { href: '/app/assistant', labelEn: 'AI Assistant', labelAr: 'المساعد الذكي', icon: Bot },
    { href: '/about', labelEn: 'Methodology', labelAr: 'المنهجية', icon: Info },
  ];

  // Global GSAP cinematic entrance choreography on route transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { y: -14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out', overwrite: 'auto' }
        );
      }

      // On inner routes, choreograph page headings and glass surfaces smoothly
      if (pathname !== '/') {
        const targets = document.querySelectorAll(
          '[data-gsap="reveal"], .cinematic-page h1, .cinematic-page .glass, .cinematic-page .glass-interactive'
        );
        if (targets.length > 0) {
          gsap.fromTo(
            targets,
            { y: 24, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.72,
              stagger: 0.045,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
              overwrite: 'auto',
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, [pathname]);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-40 transition-colors duration-500"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,15,0.88) 0%, rgba(5,7,15,0.58) 72%, rgba(5,7,15,0) 100%)',
        }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 font-serif text-[20px] font-semibold tracking-tight text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd166]/40 bg-[#f5a524]/15 text-[#ffd166] shadow-[0_0_20px_rgba(245,165,36,0.25)] transition-transform duration-300 group-hover:scale-105">
                <Sun className="h-4 w-4" />
              </span>
              <span>SolarSense</span>
            </Link>

            {/* Glass Navigation Pill Bar */}
            <nav
              aria-label="Primary Navigation"
              className="hidden items-center gap-1 rounded-full border border-white/[0.14] bg-[#0a0d1c]/65 p-1 backdrop-blur-xl lg:flex"
            >
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
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] transition-all duration-300 ${
                      active
                        ? 'bg-[#f5a524] font-semibold text-[#221500] shadow-[0_4px_18px_rgba(245,165,36,0.4)]'
                        : 'text-[#b9bdcf] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={toggleLang}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.16] bg-[#0a0d1c]/65 px-3.5 py-1.5 text-xs font-medium text-[#f4f5fa] backdrop-blur-xl transition hover:border-[#ffd166]/60 hover:text-white"
              title="Switch Language (English / العربية)"
            >
              <Languages className="h-3.5 w-3.5 text-[#ffd166]" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>

            {clockLabel && (
              <div
                id="clock"
                className=" shrink-0 whitespace-nowrap rounded-full border border-white/[0.16] bg-[#0a0d1c]/65 px-3.5 py-1.5 font-mono text-[12px] tracking-[0.12em] uppercase text-white backdrop-blur-xl"
              >
                {clockLabel}
              </div>
            )}
          </div>
        </div>

        {/* Compact Mobile Navigation Strip */}
        <div className="flex items-center gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
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
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] backdrop-blur-md transition ${
                  active
                    ? 'border-[#f5a524] bg-[#f5a524] font-semibold text-[#221500]'
                    : 'border-white/15 bg-[#0a0d1c]/70 text-[#b9bdcf]'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{isAr ? item.labelAr : item.labelEn}</span>
              </Link>
            );
          })}
        </div>
      </header>
      {pathname !== '/' && <div className="h-16" />}
    </>
  );
}
