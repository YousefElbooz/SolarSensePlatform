'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Navbar, useLanguage } from '@/components/Navbar';
import { PanelThreeViewer, RooftopThreeViewer } from '@/components/SolarThreeViewers';
import { GlobeLocationModal } from '@/components/GlobeLocationModal';
import { runAssessment } from '@/domain/business';
import {
  PANEL_TECHNOLOGIES,
  PANEL_TECH_LIST,
  getDefaultPanelPriceEgp,
  getMaxPanelsForArea,
  normalizePanelTech,
  techToShortKey,
} from '@/domain/panels';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { REGIONS, snapToGridCell } from '@/domain/regions';
import { LiveWeatherObservation, PanelTech, SitePoint } from '@/domain/types';
import {
  Compass,
  MapPin,
  ArrowRight,
  FileSpreadsheet,
  Box,
  Activity,
  Share2,
  Check,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ChapterDef {
  id: string;
  clip: string;
  mode: 'scrub' | 'play';
  long?: boolean;
  center?: boolean;
  from?: number;
  t0: number;
  t1: number;
  nameEn: string;
  nameAr: string;
  grade?: string;
  gradeOpacity?: number;
}

const CHAPTERS: ChapterDef[] = [
  {
    id: 'dawn',
    clip: 'sunrise',
    mode: 'scrub',
    long: true,
    from: 0.12,
    t0: 5.2,
    t1: 6.6,
    nameEn: 'Before dawn',
    nameAr: 'قبل الفجر',
  },
  {
    id: 'dunes',
    clip: 'dunes',
    mode: 'play',
    t0: 6.6,
    t1: 7.6,
    nameEn: 'Early morning',
    nameAr: 'الصباح الباكر',
    grade: '#ffb35a',
    gradeOpacity: 0.25,
  },
  {
    id: 'why',
    clip: 'dust',
    mode: 'play',
    t0: 7.6,
    t1: 9.0,
    nameEn: 'Why it is hard',
    nameAr: 'لماذا التنبؤ صعب؟',
  },
  {
    id: 'panel',
    clip: 'redDune',
    mode: 'play',
    center: true,
    t0: 9.0,
    t1: 10.0,
    nameEn: 'Choose your panel',
    nameAr: 'اختر اللوح الشمسي',
  },
  {
    id: 'where',
    clip: 'aswan',
    mode: 'play',
    t0: 10.0,
    t1: 11.5,
    nameEn: 'Where are you?',
    nameAr: 'أين موقعك؟',
  },
  {
    id: 'noon',
    clip: 'noon',
    mode: 'play',
    t0: 11.5,
    t1: 13.0,
    nameEn: 'Your sky right now',
    nameAr: 'سماء موقعك الآن',
  },
  {
    id: 'space',
    clip: 'cairo',
    mode: 'play',
    t0: 13.0,
    t1: 15.0,
    nameEn: 'Space and budget',
    nameAr: 'المساحة والميزانية',
  },
  {
    id: 'predict',
    clip: 'field',
    mode: 'play',
    t0: 15.0,
    t1: 16.5,
    nameEn: 'Prediction',
    nameAr: 'منحنى الإنتاج',
  },
  {
    id: 'business',
    clip: 'glint',
    mode: 'play',
    t0: 16.5,
    t1: 18.0,
    nameEn: 'Business case',
    nameAr: 'دراسة الجدوى',
    grade: '#ff9a3c',
    gradeOpacity: 0.3,
  },
  {
    id: 'dusk',
    clip: 'sunset',
    mode: 'scrub',
    long: true,
    t0: 18.0,
    t1: 19.4,
    nameEn: 'Dusk',
    nameAr: 'الغسق',
  },
  {
    id: 'night',
    clip: 'stars',
    mode: 'scrub',
    long: true,
    t0: 19.4,
    t1: 22.5,
    nameEn: 'After dark',
    nameAr: 'بعد الغروب',
  },
];

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function smoothStep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function formatHhMm(decimalHour: number): string {
  const h = Math.floor(decimalHour);
  const m = Math.floor((decimalHour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function PlanDayArcPage() {
  const { isAr } = useLanguage();

  // Plan flow state synced with URL query parameters
  const [tech, setTech] = useState<PanelTech>('pc-Si');
  const [site, setSite] = useState<SitePoint>(() => snapToGridCell(30.04, 31.24));
  const [locationChosen, setLocationChosen] = useState<boolean>(false);
  const [locationSource, setLocationSource] = useState<string>('Cairo (default)');
  const [usableAreaM2, setUsableAreaM2] = useState<number>(40);
  const [panelCount, setPanelCount] = useState<number>(() => getMaxPanelsForArea(40, 'pc-Si'));
  const [customPanelPricesEgp, setCustomPanelPricesEgp] = useState<Record<PanelTech, number>>(() => ({
    'pc-Si': getDefaultPanelPriceEgp('pc-Si'),
    'a-Si:H/sc-Si': getDefaultPanelPriceEgp('a-Si:H/sc-Si'),
    CIGS: getDefaultPanelPriceEgp('CIGS'),
  }));
  const [budgetEgp, setBudgetEgp] = useState<number>(180000);
  const [monthlyBillEgp, setMonthlyBillEgp] = useState<number>(2400);
  const [daytimeSharePct, setDaytimeSharePct] = useState<number>(45);

  const maxRoofPanels = useMemo(() => getMaxPanelsForArea(usableAreaM2, tech), [usableAreaM2, tech]);
  const activePanelPriceEgp = customPanelPricesEgp[tech] ?? getDefaultPanelPriceEgp(tech);
  const defaultPanelPriceEgp = getDefaultPanelPriceEgp(tech);

  // Keep panelCount within roof limit when tech changes
  useEffect(() => {
    setPanelCount((prev) => Math.max(1, Math.min(maxRoofPanels, prev)));
  }, [maxRoofPanels]);

  const [globeOpen, setGlobeOpen] = useState<boolean>(false);
  const [globeAutoLocate, setGlobeAutoLocate] = useState<boolean>(false);
  const [weather, setWeather] = useState<LiveWeatherObservation | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Scroll, GSAP & Video Stage refs
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const gradeRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const progress3dRef = useRef<Record<string, number>>({ panel: 0.5, space: 0.5 });

  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [clockLabel, setClockLabel] = useState<string>('05:12 · Before dawn');

  // Hydrate initial state from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tech');
    const resolvedTech = t ? normalizePanelTech(t) : 'pc-Si';
    if (t) setTech(resolvedTech);
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat > 20 && lon > 20) {
      setSite(snapToGridCell(lat, lon));
      setLocationChosen(true);
    }
    const area = Number(params.get('area'));
    const resolvedArea = !Number.isNaN(area) && area >= 10 && area <= 500 ? area : 40;
    if (!Number.isNaN(area) && area >= 10 && area <= 500) setUsableAreaM2(area);

    const panelsParam = Number(params.get('panels'));
    if (!Number.isNaN(panelsParam) && panelsParam >= 1 && panelsParam <= 200) {
      setPanelCount(Math.min(getMaxPanelsForArea(resolvedArea, resolvedTech), panelsParam));
    } else {
      setPanelCount(getMaxPanelsForArea(resolvedArea, resolvedTech));
    }

    const panelPriceParam = Number(params.get('panelPrice'));
    if (!Number.isNaN(panelPriceParam) && panelPriceParam >= 500 && panelPriceParam <= 50000) {
      setCustomPanelPricesEgp((prev) => ({
        ...prev,
        [resolvedTech]: Math.round(panelPriceParam),
      }));
    }

    const budget = Number(params.get('budget'));
    if (!Number.isNaN(budget) && budget >= 40000 && budget <= 2000000) setBudgetEgp(budget);
    const bill = Number(params.get('bill'));
    if (!Number.isNaN(bill) && bill >= 300 && bill <= 100000) setMonthlyBillEgp(bill);
  }, []);

  // Sync state changes back to URL query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tech', techToShortKey(tech));
    params.set('area', String(usableAreaM2));
    params.set('panels', String(panelCount));
    params.set('panelPrice', String(activePanelPriceEgp));
    if (locationChosen) {
      params.set('lat', site.cellLat.toFixed(2));
      params.set('lon', site.cellLon.toFixed(2));
    }
    window.history.replaceState(null, '', `?${params.toString()}${window.location.hash}`);
  }, [tech, site.cellLat, site.cellLon, locationChosen, usableAreaM2, panelCount, activePanelPriceEgp]);

  // Fetch live Open-Meteo weather for the snapped 0.25° ERA5 cell
  useEffect(() => {
    let active = true;
    setWeatherLoading(true);
    fetch(`/api/weather?lat=${site.cellLat}&lon=${site.cellLon}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.weather) setWeather(data.weather);
        setWeatherLoading(false);
      })
      .catch(() => {
        if (active) setWeatherLoading(false);
      });
    return () => {
      active = false;
    };
  }, [site.cellLat, site.cellLon]);

  // Compute full business assessment & forecast curve
  const assessment = useMemo(
    () =>
      runAssessment({
        tech,
        lat: site.cellLat,
        lon: site.cellLon,
        usableAreaM2,
        budgetEgp,
        panelCount,
        panelUnitPriceEgp: activePanelPriceEgp,
        monthlyBillEgp,
        daytimeSharePct,
      }),
    [
      tech,
      site.cellLat,
      site.cellLon,
      usableAreaM2,
      budgetEgp,
      panelCount,
      activePanelPriceEgp,
      monthlyBillEgp,
      daytimeSharePct,
    ]
  );

  const forecast = useMemo(
    () =>
      predictionProvider.forecast({
        site,
        system: {
          tech,
          panelCount: assessment.chosen.panelCount,
          kWp: assessment.chosen.kWp,
          tiltDeg: Math.round(site.cellLat * 0.9),
          azimuthDeg: 180,
        },
        horizonH: 1,
        mode: 'live',
        skyCondition: 'clear',
      }),
    [site, tech, assessment.chosen.panelCount, assessment.chosen.kWp]
  );

  // Smooth GSAP micro-transition whenever active chapter changes
  useEffect(() => {
    const activeEl = contentRefs.current[activeIdx];
    if (!activeEl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = activeEl.querySelectorAll('[data-gsap-item]');
    if (items.length > 0) {
      gsap.fromTo(
        items,
        { y: 18, opacity: 0.25 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.055,
          ease: 'power3.out',
          overwrite: 'auto',
        }
      );
    }
  }, [activeIdx]);

  // Lenis + GSAP Ticker + Scroll-driven video crossfading, scrubbing, and chapter easing
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const uniqueClips = Array.from(new Set(CHAPTERS.map((c) => c.clip)));

    const getClipSrc = (clipKey: string) => {
      const file = clipKey === 'sunset' && portrait ? 'sunset_portrait' : clipKey;
      return `/footage/web/${file}.mp4`;
    };

    const ensureVideoLoaded = (clipKey: string) => {
      const v = videoRefs.current[clipKey];
      if (v && !v.src) {
        v.preload = 'auto';
        v.src = getClipSrc(clipKey);
        v.load();
      }
    };

    // Preload initial chapters immediately
    ['sunrise', 'dunes', 'dust'].forEach(ensureVideoLoaded);

    // Initialize Lenis smooth scrolling synced with GSAP ticker
    const lenis = !reduce
      ? new Lenis({
          lerp: 0.082,
          wheelMultiplier: 0.9,
          smoothWheel: true,
        })
      : null;
    lenisRef.current = lenis;

    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
    }

    let prevActiveIdx = -1;
    let lastScrollY = -9999;
    let lastClockStr = '';

    const scrubVideo = (ch: ChapterDef, progress: number) => {
      const v = videoRefs.current[ch.clip];
      if (!v || v.readyState < 1 || !Number.isFinite(v.duration)) return;
      const from = ch.from || 0;
      const targetTime = (reduce ? 0.6 : from + (1 - from) * progress) * (v.duration - 0.08);
      if (!v.seeking && Math.abs(v.currentTime - targetTime) > 0.04) {
        v.currentTime = targetTime;
      }
    };

    const onTick = (timeSeconds: number) => {
      if (lenis) {
        lenis.raf(timeSeconds * 1000);
      }

      const curScrollY = window.scrollY;
      if (Math.abs(curScrollY - lastScrollY) < 0.05 && prevActiveIdx !== -1) {
        return;
      }
      lastScrollY = curScrollY;

      const vh = window.innerHeight || 800;
      const mid = vh / 2;
      let currentIdx = 0;

      const rects = CHAPTERS.map((_, i) => {
        const el = sectionRefs.current[i];
        return el ? el.getBoundingClientRect() : null;
      });

      rects.forEach((r, idx) => {
        if (r && r.top <= mid) currentIdx = idx;
      });

      if (currentIdx !== prevActiveIdx) {
        prevActiveIdx = currentIdx;
        setActiveIdx(currentIdx);
        const activeCh = CHAPTERS[currentIdx];

        [currentIdx - 1, currentIdx, currentIdx + 1].forEach((idx) => {
          if (CHAPTERS[idx]) ensureVideoLoaded(CHAPTERS[idx].clip);
        });

        // Smooth GSAP grade transition
        if (gradeRef.current) {
          gsap.to(gradeRef.current, {
            backgroundColor: activeCh.grade || 'rgba(0,0,0,0)',
            opacity: activeCh.gradeOpacity || 0,
            duration: 1.35,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        }
      }

      const ch = CHAPTERS[currentIdx];
      const nextCh = CHAPTERS[currentIdx + 1];
      const rect = rects[currentIdx];

      const progress = rect ? clamp((mid - rect.top) / Math.max(1, rect.height), 0, 1) : 0;
      const clockTime = ch.t0 + (ch.t1 - ch.t0) * progress;
      const nextClockStr = `${formatHhMm(clockTime)} · ${isAr ? ch.nameAr : ch.nameEn}`;
      if (nextClockStr !== lastClockStr) {
        lastClockStr = nextClockStr;
        const clockEl = document.getElementById('clock');
        if (clockEl) {
          clockEl.textContent = nextClockStr;
        }
      }

      // Film backdrop cross-fade tied to scroll position
      const nextRect = rects[currentIdx + 1];
      const blend = nextRect ? 1 - smoothStep(0, vh * 0.5, nextRect.top - mid) : 0;

      uniqueClips.forEach((clipKey) => {
        const v = videoRefs.current[clipKey];
        if (!v) return;
        const opacity =
          clipKey === ch.clip ? 1 : nextCh && clipKey === nextCh.clip ? blend : 0;
        v.style.opacity = opacity.toFixed(3);

        const owner = clipKey === ch.clip ? ch : nextCh;
        const shouldPlay = opacity > 0.01 && owner?.mode === 'play' && !reduce;
        if (shouldPlay && v.paused) {
          v.play().catch(() => {});
        } else if (!shouldPlay && !v.paused) {
          v.pause();
        }
      });

      if (ch.mode === 'scrub') scrubVideo(ch, progress);
      if (nextCh && blend > 0 && nextCh.mode === 'scrub') scrubVideo(nextCh, 0);

      // Smooth chapter content entrance & exit transform (matching day_arc_prototype.html)
      if (!reduce) {
        [currentIdx - 1, currentIdx, currentIdx + 1].forEach((j) => {
          const el = contentRefs.current[j];
          const r = rects[j];
          if (!el || !r) return;
          const q = -r.top / vh;
          const remaining = (r.bottom - vh) / vh;
          const inn = j === 0 ? 1 : smoothStep(-0.6, 0.02, q);
          const out = j === CHAPTERS.length - 1 ? 1 : smoothStep(0, 0.42, remaining);
          const alpha = inn * out;
          const ty = (1 - inn) * 64 - (1 - out) * 44;
          el.style.opacity = alpha.toFixed(3);
          el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`;
        });
      }

      // Update 3D scroll progress for Panel & Roof viewers
      [currentIdx - 1, currentIdx, currentIdx + 1].forEach((j) => {
        const c = CHAPTERS[j];
        const r = rects[j];
        if (c && r) {
          progress3dRef.current[c.id] = clamp((vh - r.top) / (r.height + vh), 0, 1);
        }
      });
    };

    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      if (lenis) {
        lenis.destroy();
        lenisRef.current = null;
      }
    };
  }, [isAr]);

  // Pause Lenis while 3D Globe modal is open
  useEffect(() => {
    if (!lenisRef.current) return;
    if (globeOpen) {
      lenisRef.current.stop();
      document.body.style.overflow = 'hidden';
    } else {
      lenisRef.current.start();
      document.body.style.overflow = '';
    }
  }, [globeOpen]);

  const scrollToChapter = (id: string, offsetFraction = 0) => {
    const el = document.getElementById(id);
    if (!el) return;
    const targetTop = el.offsetTop + (offsetFraction ? window.innerHeight * offsetFraction : 2);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetTop, {
        duration: 1.75,
        easing: (t: number) => 1 - Math.pow(1 - t, 4),
      });
    } else {
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const regionInfo = REGIONS[site.region];
  const uniqueClips = useMemo(() => Array.from(new Set(CHAPTERS.map((c) => c.clip))), []);

  // SVG Forecast Curve coordinates (matching prototype curve layout + clear-sky reference)
  const maxChartKw = Math.max(1, assessment.chosen.kWp);
  const svgPoints = forecast.points.map((pt, idx) => {
    const x = 40 + (idx / Math.max(1, forecast.points.length - 1)) * 720;
    const yMean = 190 - (pt.pKw / maxChartKw) * 150;
    const yP10 = 190 - (pt.p10Kw / maxChartKw) * 150;
    const yP90 = 190 - (pt.p90Kw / maxChartKw) * 150;
    const yClear = 190 - (pt.pClearKw / maxChartKw) * 150;
    return { x, yMean, yP10, yP90, yClear, pt };
  });

  const meanPath = svgPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.yMean.toFixed(1)}`)
    .join(' ');
  const clearPath = svgPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.yClear.toFixed(1)}`)
    .join(' ');
  const areaFillPath = `${meanPath} L760 190 L40 190 Z`;
  const bandPath =
    svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.yP90.toFixed(1)}`).join(' ') +
    ' ' +
    [...svgPoints]
      .reverse()
      .map((p) => `L${p.x.toFixed(1)} ${p.yP10.toFixed(1)}`)
      .join(' ') +
    ' Z';

  const peakKw = Math.max(...forecast.points.map((p) => p.pKw), 0);
  const reportHref = `/report/${assessment.id}?tech=${tech}&lat=${site.cellLat}&lon=${site.cellLon}&area=${usableAreaM2}&panels=${assessment.chosen.panelCount}&panelPrice=${activePanelPriceEgp}&budget=${assessment.chosen.capexEgp}&bill=${monthlyBillEgp}`;

  return (
    <div className="relative min-h-screen bg-[#05070f] text-[#f4f5fa]">
      <Navbar clockLabel={clockLabel} />

      {/* Fixed Film Backdrop Stage (matches day_arc_prototype.html .stage) */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#05070f]" aria-hidden="true">
        {uniqueClips.map((clipKey) => (
          <video
            key={clipKey}
            ref={(el) => {
              videoRefs.current[clipKey] = el;
            }}
            muted
            playsInline
            loop
            preload="none"
            poster={`/footage/web/${clipKey}.jpg`}
            className="absolute inset-0 h-full w-full object-cover opacity-0 will-change-[opacity]"
          />
        ))}
        <div
          ref={gradeRef}
          className="pointer-events-none absolute inset-0 mix-blend-soft-light"
          style={{ backgroundColor: 'transparent', opacity: 0 }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,7,15,0.55) 0%, rgba(5,7,15,0.12) 26%, rgba(5,7,15,0.30) 52%, rgba(5,7,15,0.78) 100%)',
          }}
        />
      </div>

      {/* Right-hand Progress Rail (matches day_arc_prototype.html .rail) */}
      <nav
        className="fixed right-[18px] top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-[11px] md:flex"
        aria-label="Chapters"
      >
        {CHAPTERS.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => scrollToChapter(ch.id)}
            title={isAr ? ch.nameAr : ch.nameEn}
            aria-label={isAr ? ch.nameAr : ch.nameEn}
            className={`h-[9px] w-[9px] rounded-full transition-all duration-300 ${
              idx === activeIdx
                ? 'bg-[#ffd166] shadow-[0_0_0_4px_rgba(255,209,102,0.28)]'
                : 'bg-white/35 hover:bg-white/75'
            }`}
          />
        ))}
      </nav>

      {/* Main Scroll Chapters */}
      <main className="relative z-10">
        {/* CHAPTER 1: DAWN HERO */}
        <section
          id="dawn"
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="relative min-h-[260vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[0] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[660px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'سولار سينس · مصر' : 'SolarSense · Egypt'}
                </div>
                <h1 data-gsap-item className="cinematic-h1 mt-3 mb-4">
                  {isAr
                    ? 'اعرف ما ستمنحه لك الشمس قبل أن تشتري لوحاً واحداً.'
                    : 'Know what the sun will give you before you buy a single panel.'}
                </h1>
                <p data-gsap-item className="cinematic-lede mb-6">
                  {isAr
                    ? 'اختر اللوح الشمسي، حدد مكانك في مصر، وشاهد ما سينتجه وما سيكلفه ومتى يسترد تكلفته.'
                    : 'Choose a panel, find your place in Egypt, and see what it will produce, what it will cost and when it pays back.'}
                </p>
                <div data-gsap-item className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToChapter('panel')}
                    className="btn-pill-primary"
                  >
                    <span>{isAr ? 'ابدأ التخطيط من الفجر ↓' : 'Start planning your roof ↓'}</span>
                  </button>
                  <Link href={reportHref} className="btn-pill">
                    <span>{isAr ? 'معاينة التقرير المالي' : 'Sample engineering report'}</span>
                  </Link>
                  <Link href="/app" className="btn-pill">
                    <span>{isAr ? 'مركز التشغيل (Operate)' : 'Fleet Operate Center'}</span>
                  </Link>
                </div>
                <div
                  data-gsap-item
                  className="mt-7 font-mono text-xs uppercase tracking-[0.16em] text-white/85"
                >
                  {isAr ? 'مرر للأسفل لترفع الشمس ↓' : 'Scroll to raise the sun ↓'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 2A: EARLY MORNING DUNES */}
        <section
          id="dunes"
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[1] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[640px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'الصباح الباكر' : 'Early morning'}
                </div>
                <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3.5">
                  {isAr
                    ? 'تمتلك مصر سطوعاً شمسياً يفوق معظم بقاع الأرض.'
                    : 'Egypt has more sun than almost anywhere on Earth.'}
                </h2>
                <p data-gsap-item className="cinematic-lede">
                  {isAr
                    ? 'أكثر من إحدى عشرة ساعة يومياً. لم تكن المشكلة يوماً هل تشرق الشمس، بل معرفة كم ستحول ألواحك منها إلى طاقة هنا، على هذا السطح تحديداً.'
                    : 'Up to eleven hours of it a day. The hard part was never whether the sun shines. It is knowing how much of it your panels will turn into power, here, on this roof.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 2B: WHY IT IS HARD */}
        <section
          id="why"
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[2] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'الصباح · لماذا الأمر صعب' : 'Morning · why it is hard'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-5">
                {isAr ? 'الشمس يمكن التنبؤ بها. أما السماء فلا.' : 'The sun is predictable. The sky is not.'}
              </h2>
              <div className="grid gap-3.5 md:grid-cols-3">
                <div data-gsap-item className="glass">
                  <b className="block font-serif text-[21px] font-semibold text-white mb-1">
                    {isAr ? 'الغبار والعوالق' : 'Dust'}
                  </b>
                  <span className="text-[14px] text-[#b9bdcf]">
                    {isAr
                      ? 'رياح الخماسين الربيعية تحجب جزءاً كبيراً من الإشعاع المباشر (حتى 41% من DNI) وتترك طبقة على الزجاج.'
                      : 'Spring Khamaseen winds can strip a large share of direct sunlight on a bad day, and leave a film on the glass.'}
                  </span>
                </div>
                <div data-gsap-item className="glass">
                  <b className="block font-serif text-[21px] font-semibold text-white mb-1">
                    {isAr ? 'الحرارة' : 'Heat'}
                  </b>
                  <span className="text-[14px] text-[#b9bdcf]">
                    {isAr
                      ? 'الألواح الساخنة تفقد جزءاً من قدرتها فوق 25°م. مقدار الفقد يعتمد على المعامل الحراري (γ) للوح الذي تختاره.'
                      : 'Hot panels lose output above 25°C. How much depends on the thermal coefficient (γ) of the panel you choose.'}
                  </span>
                </div>
                <div data-gsap-item className="glass">
                  <b className="block font-serif text-[21px] font-semibold text-white mb-1">
                    {isAr ? 'أربع سماوات' : 'Four skies'}
                  </b>
                  <span className="text-[14px] text-[#b9bdcf]">
                    {isAr
                      ? 'الساحل الرطب والدلتا، الصحراء الغربية، سيناء والبحر الأحمر، ووادي النيل والصعيد لكل منها سلوك مختلف.'
                      : 'The humid coast, the Western Desert, Sinai and the Red Sea, and the Nile Valley all behave differently.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 3: CHOOSE YOUR PANEL (3D VIEWER + CARDS) */}
        <section
          id="panel"
          ref={(el) => {
            sectionRefs.current[3] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-24">
            <div
              ref={(el) => {
                contentRefs.current[3] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'منتصف الصباح · خطوة 1' : 'Mid-morning · step 1'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2 mb-4">
                {isAr ? 'ثلاث طرق لالتقاط نفس الضوء' : 'Three ways to catch the same light'}
              </h2>

              <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <PanelThreeViewer
                  tech={tech}
                  isAr={isAr}
                  heightClass="h-[260px] sm:h-[min(56vh,480px)]"
                  getProgress={() => progress3dRef.current.panel ?? 0.5}
                />

                <div className="grid gap-3.5">
                  {PANEL_TECH_LIST.map((item) => {
                    const selected = item.key === tech;
                    const recForRegion = regionInfo.recommendedTech === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setTech(item.key)}
                        className={`glass-interactive w-full text-left px-4 py-3.5 ${
                          selected ? 'glass-selected' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <h3 className="font-serif text-[20px] font-semibold text-white">
                              {isAr ? item.nameAr : item.nameEn}
                            </h3>
                            <small className="block text-[13px] text-[#b9bdcf]">
                              {isAr ? item.subtitleAr : item.subtitleEn}
                            </small>
                          </div>
                          {recForRegion && (
                            <span className="tag-pill live">
                              {isAr ? `الأنسب لـ ${regionInfo.code}` : `Best for ${regionInfo.code}`}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-white/[0.16] pt-2.5 text-[13px] sm:grid-cols-[1fr_auto_1fr_auto]">
                          <span className="text-[#b9bdcf]">{isAr ? 'الكفاءة' : 'Efficiency'}</span>
                          <span className="text-right font-semibold text-white">
                            {item.efficiencyRange}
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'الفقد لكل °م' : 'Loss per °C of heat'}
                          </span>
                          <span className="text-right font-semibold text-[#ffd166]">
                            {item.tempCoeffRange}
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'المساحة لكل ك.و' : 'Roof per kWp'}
                          </span>
                          <span className="text-right font-semibold text-white">
                            {item.areaPerKwpLabel}
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'الفئة السعرية' : 'Price tier'}
                          </span>
                          <span className="text-right font-semibold text-white">
                            {item.priceTier}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#b9bdcf]">
                <span>
                  {isAr
                    ? 'نطاقات قياسية للتقنيات الثلاث، وتتم مقارنتها جميعاً على سطحك في الفصل الثامن.'
                    : 'Typical module ranges; all three technologies are compared side-by-side on your roof in Golden Hour.'}
                </span>
                <Link href="/panels" className="text-[#ffd166] hover:underline">
                  {isAr ? 'فتح مختبر فيزياء الألواح 3D ←' : 'Open 3D Module Physics Lab →'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 4: WHERE ARE YOU? (3D SATELLITE GLOBE DETECTOR) */}
        <section
          id="where"
          ref={(el) => {
            sectionRefs.current[4] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[4] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[640px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'الضحى · خطوة 2' : 'Late morning · step 2'}
                </div>
                <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3.5">
                  {isAr
                    ? 'كل سماء في مصر مختلفة. أيّها سماؤك؟'
                    : 'Every sky in Egypt is different. Which one is yours?'}
                </h2>
                <p data-gsap-item className="cinematic-lede mb-5">
                  {isAr
                    ? 'نحدد موقعك على الكرة الأرضية، ثم نطابقه مع إقليمك المناخي وأقرب خلية بيانات طقس (25 كم).'
                    : 'We find you on the globe, then match you to your climate region and the nearest weather data.'}
                </p>

                {!locationChosen ? (
                  <div data-gsap-item>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setGlobeAutoLocate(true);
                          setGlobeOpen(true);
                        }}
                        className="btn-pill-primary"
                      >
                        <span>{isAr ? 'حدد موقعي' : 'Find my location'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGlobeAutoLocate(false);
                          setGlobeOpen(true);
                        }}
                        className="btn-pill"
                      >
                        <span>{isAr ? 'اختر على الخريطة' : 'Choose on the map'}</span>
                      </button>
                    </div>
                    <div className="mt-3 text-[12px] text-[#b9bdcf]">
                      {isAr
                        ? 'يبقى موقعك الدقيق داخل هذه الصفحة. يُرسل فقط مربع الطقس (25 كم) الذي يقع فيه لخدمة الطقس.'
                        : 'Your exact position stays in this page. Only the 25 km weather grid square it falls in is sent to the weather service.'}
                    </div>
                  </div>
                ) : (
                  <div data-gsap-item className="glass">
                    <div className="flex flex-col gap-1">
                      <div className="text-[12px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                        {isAr ? 'موقعك' : 'Your place'}
                      </div>
                      <div className="font-serif text-[clamp(22px,2.8vw,32px)] leading-[1.1] text-white">
                        {isAr ? regionInfo.nameAr : regionInfo.nameEn}
                      </div>
                      <div className="text-[13px] text-[#b9bdcf]">
                        {isAr
                          ? `خلية بيانات الطقس ${site.cellLat.toFixed(2)}° شمالاً، ${site.cellLon.toFixed(2)}° شرقاً${site.inCoverage ? '' : ' (أقرب خلية مغطاة)'} · حدود الأقاليم مبدئية`
                          : `Weather data cell ${site.cellLat.toFixed(2)}° N, ${site.cellLon.toFixed(2)}° E${site.inCoverage ? '' : ' (nearest covered cell)'} · region borders provisional`}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setGlobeAutoLocate(false);
                          setGlobeOpen(true);
                        }}
                        className="btn-pill"
                      >
                        {isAr ? 'تغيير الموقع' : 'Change location'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 5: NOON LIVE WEATHER TILES */}
        <section
          id="noon"
          ref={(el) => {
            sectionRefs.current[5] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[5] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'الظهيرة · سماء موقعك الآن' : 'Noon · your sky right now'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3">
                {isAr ? 'هذا ما يراه نموذج التنبؤ.' : 'This is what the model sees.'}
              </h2>
              <p data-gsap-item className="cinematic-lede mb-5">
                {isAr
                  ? 'نفس القياسات الفيزيائية التي تدرب عليها نموذج التنبؤ، مقروءة مباشرة لموقعك.'
                  : 'The same measurements the forecast was trained on, read live for your location.'}{' '}
                <span className="tag-pill live align-middle">
                  {weatherLoading
                    ? isAr
                      ? 'جاري التحميل'
                      : 'loading'
                    : weather?.provider === 'open-meteo-live'
                      ? 'live'
                      : 'era5-ref'}
                </span>
              </p>

              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الإشعاع على الأرض' : 'Sunlight on the ground'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.shortwaveRadiationWm2 : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">W/m²</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الإشعاع المباشر' : 'Direct sunlight'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.directRadiationWm2 : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">W/m²</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'حرارة الهواء' : 'Air temperature'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.temperature2mC : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">°C</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الرياح' : 'Wind'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.windSpeed10mKmh : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">km/h</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الغطاء السحابي' : 'Cloud cover'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.cloudCoverPct : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">%</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الرطوبة' : 'Humidity'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.relativeHumidityPct : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">%</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الضغط الجوي' : 'Pressure'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-white">
                    {weather ? weather.surfacePressureHpa : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">hPa</div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'مؤشر الغبار (AOD)' : 'Dust index (AOD)'}
                  </div>
                  <div className="mt-1 font-serif text-[28px] leading-[1.15] text-[#9fe9e9]">
                    {weather ? weather.dustAod : '–'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">{regionInfo.dustRisk} profile</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-[#b9bdcf]">
                {weather
                  ? `${site.anchorName || 'Grid cell'} (${site.cellLat.toFixed(2)}° N, ${site.cellLon.toFixed(2)}° E), ${weather.timestamp} local time. Weather data by Open-Meteo.com.`
                  : ''}{' '}
                {!locationChosen &&
                  (isAr
                    ? 'تُعرض القاهرة حتى يتم اختيار موقع.'
                    : 'Cairo is shown until a location is chosen.')}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 6: SPACE, PANELS & 3D ROOFTOP CONFIGURATOR */}
        <section
          id="space"
          ref={(el) => {
            sectionRefs.current[6] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[6] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'بداية العصر · خطوة 3' : 'Early afternoon · step 3'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2 mb-4">
                {isAr
                  ? 'كم مساحة السطح، وكم عدد الألواح؟'
                  : 'How much roof, and how many panels?'}
              </h2>

              <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <RooftopThreeViewer
                  tech={tech}
                  panelCount={assessment.chosen.panelCount}
                  areaM2={usableAreaM2}
                  tiltDeg={Math.round(site.cellLat * 0.9)}
                  isAr={isAr}
                  heightClass="h-[260px] sm:h-[min(56vh,480px)]"
                  getProgress={() => progress3dRef.current.space ?? 0.5}
                />

                <div className="grid gap-3.5">
                  <div className="glass">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="area" className="block text-[13px] text-[#b9bdcf]">
                        {isAr ? 'مساحة السطح المتاحة' : 'Usable roof area'}
                      </label>
                      <span className="font-mono text-[11px] text-[#9fe9e9]">
                        {isAr
                          ? `يتسع حتى ${maxRoofPanels} لوح (${PANEL_TECHNOLOGIES[tech].panelAreaM2} م² للوح)`
                          : `Fits up to ${maxRoofPanels} panels (${PANEL_TECHNOLOGIES[tech].panelAreaM2} m² each)`}
                      </span>
                    </div>
                    <input
                      id="area"
                      type="range"
                      min={10}
                      max={200}
                      step={5}
                      value={usableAreaM2}
                      onChange={(e) => {
                        const nextArea = Number(e.target.value);
                        setUsableAreaM2(nextArea);
                        setPanelCount(getMaxPanelsForArea(nextArea, tech));
                      }}
                      className="w-full"
                    />
                    <div className="mt-1 font-serif text-[24px] text-white">
                      <span>{usableAreaM2}</span> m²
                    </div>
                  </div>

                  <div className="glass">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="panels-count" className="block text-[13px] text-[#b9bdcf]">
                        {isAr ? 'عدد الألواح الشمسية' : 'Number of panels'}
                      </label>
                      <span className="font-mono text-[11px] text-[#ffd166]">
                        {assessment.chosen.kWp.toFixed(2)} kWp ({PANEL_TECHNOLOGIES[tech].panelWp} Wp / {isAr ? 'لوح' : 'panel'})
                      </span>
                    </div>
                    <input
                      id="panels-count"
                      type="range"
                      min={1}
                      max={Math.max(1, maxRoofPanels)}
                      step={1}
                      value={assessment.chosen.panelCount}
                      onChange={(e) => setPanelCount(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-serif text-[24px] text-white">
                        <span>{assessment.chosen.panelCount}</span> {isAr ? 'لوحاً' : 'panels'}
                        <span className="ml-2 text-xs font-sans text-[#b9bdcf]">
                          ({assessment.chosen.roofAreaUsedM2} m² {isAr ? 'مستخدمة' : 'module area'})
                        </span>
                      </div>
                    </div>

                    {/* Provider Unit Panel Price Input */}
                    <div className="mt-3 border-t border-white/[0.12] pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <label
                          htmlFor="provider-panel-price"
                          className="block text-[12px] font-medium text-[#b9bdcf]"
                        >
                          {isAr
                            ? 'سعر اللوح الواحد حسب المورد (EGP / لوح)'
                            : 'Provider price per panel (EGP / panel)'}
                        </label>
                        {activePanelPriceEgp !== defaultPanelPriceEgp && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomPanelPricesEgp((prev) => ({
                                ...prev,
                                [tech]: defaultPanelPriceEgp,
                              }))
                            }
                            className="font-mono text-[10px] uppercase tracking-wider text-[#ffd166] underline hover:text-white"
                          >
                            {isAr
                              ? `إعادة للسعر المرجعي (${defaultPanelPriceEgp.toLocaleString('en-US')})`
                              : `Reset to market est. (EGP ${defaultPanelPriceEgp.toLocaleString('en-US')})`}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center">
                          <span className="pointer-events-none absolute left-3 font-mono text-xs text-[#b9bdcf]">
                            EGP
                          </span>
                          <input
                            id="provider-panel-price"
                            type="number"
                            min={1000}
                            max={40000}
                            step={50}
                            value={activePanelPriceEgp}
                            onChange={(e) => {
                              const val = Math.max(500, Math.min(50000, Number(e.target.value) || 0));
                              setCustomPanelPricesEgp((prev) => ({
                                ...prev,
                                [tech]: val,
                              }));
                            }}
                            className="w-[138px] rounded-xl border border-white/20 bg-white/[0.07] py-1.5 pl-11 pr-3 font-mono text-sm font-semibold text-white focus:border-[#ffd166] focus:outline-none"
                          />
                        </div>
                        <input
                          type="range"
                          aria-label="Provider price per panel slider"
                          min={1500}
                          max={18000}
                          step={50}
                          value={Math.min(18000, Math.max(1500, activePanelPriceEgp))}
                          onChange={(e) =>
                            setCustomPanelPricesEgp((prev) => ({
                              ...prev,
                              [tech]: Number(e.target.value),
                            }))
                          }
                          className="flex-1"
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-[#b9bdcf]">
                        {isAr
                          ? `السعر التقديري في السوق لـ ${PANEL_TECHNOLOGIES[tech].nameAr}: ${defaultPanelPriceEgp.toLocaleString('en-US')} ج.م/لوح (${(activePanelPriceEgp / PANEL_TECHNOLOGIES[tech].panelWp).toFixed(1)} ج.م/واط)`
                          : `Market estimate for ${PANEL_TECHNOLOGIES[tech].nameEn}: EGP ${defaultPanelPriceEgp.toLocaleString('en-US')}/panel (${(activePanelPriceEgp / PANEL_TECHNOLOGIES[tech].panelWp).toFixed(1)} EGP/Wp)`}
                      </div>
                    </div>
                  </div>

                  <div className="glass">
                    <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                      {isAr
                        ? 'التكلفة التقديرية للألواح والنظام'
                        : 'Estimated price of panels & turnkey budget'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <div className="font-serif text-[28px] leading-[1.15] text-[#ffd166]">
                        EGP <span>{assessment.chosen.itemizedCost.panelsEgp.toLocaleString('en-US')}</span>
                      </div>
                      <span className="font-mono text-xs text-white/85">
                        ({assessment.chosen.panelCount} × EGP {activePanelPriceEgp.toLocaleString('en-US')}{' '}
                        {isAr ? 'فقط للألواح' : 'panels only'})
                      </span>
                    </div>
                    <div className="mt-1.5 text-[13px] text-[#b9bdcf]">
                      {isAr ? 'التكلفة الكلية شاملة التركيب والإنفرتر: ' : 'Full turnkey installed budget: '}
                      <b className="text-white">
                        EGP {assessment.chosen.capexEgp.toLocaleString('en-US')}
                      </b>{' '}
                      <span className="text-xs text-[#b9bdcf]">
                        (+ {isAr ? 'إنفرتر' : 'Inverter'} EGP{' '}
                        {assessment.chosen.itemizedCost.inverterEgp.toLocaleString('en-US')} ·{' '}
                        {isAr ? 'شاسيه وتركيب' : 'Mounting & BOS'} EGP{' '}
                        {(
                          assessment.chosen.itemizedCost.mountingEgp +
                          assessment.chosen.itemizedCost.installationEgp
                        ).toLocaleString('en-US')}
                        )
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-[#b9bdcf]">
                <span className="tag-pill mr-2">simulated sizing</span>
                {isAr
                  ? 'يحسب عدد الألواح باستخدام معامل تعبئة 0.72 وسعر اللوح المحدد من المورد.'
                  : 'Panel sizing uses a 0.72 roof packing factor and your provider price per panel.'}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 7: AFTERNOON PREDICTION CURVE */}
        <section
          id="predict"
          ref={(el) => {
            sectionRefs.current[7] = el;
          }}
          className="relative min-h-[170vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[7] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'العصر · التنبؤ' : 'Afternoon · prediction'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-4">
                {isAr ? 'يومك من الطاقة' : 'Your day of power'}
              </h2>

              <div data-gsap-item className="glass">
                <svg
                  viewBox="0 0 800 220"
                  className="block h-auto w-full"
                  role="img"
                  aria-label="Hourly solar power curve across a day with P10-P90 uncertainty band"
                >
                  <defs>
                    <linearGradient id="powerGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#f5a524" stopOpacity="0.75" />
                      <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* P10-P90 Uncertainty Band */}
                  <path d={bandPath} fill="rgba(255,209,102,0.18)" />
                  {/* Area under expected curve */}
                  <path d={areaFillPath} fill="url(#powerGrad)" />
                  {/* Clear-sky reference envelope */}
                  <path
                    d={clearPath}
                    fill="none"
                    stroke="rgba(63,193,193,0.65)"
                    strokeWidth="1.75"
                    strokeDasharray="5 4"
                  />
                  {/* Expected AC power curve */}
                  <path d={meanPath} fill="none" stroke="#ffd166" strokeWidth="3" />
                  <g fill="#b9bdcf" fontSize="12" className="font-mono">
                    <text x="40" y="212">
                      06:00
                    </text>
                    <text x="385" y="212">
                      12:00
                    </text>
                    <text x="725" y="212">
                      18:00
                    </text>
                  </g>
                  <text
                    x="400"
                    y="26"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="15"
                    className="font-serif"
                  >
                    {peakKw > 0
                      ? isAr
                        ? `الذروة حوالي ${peakKw.toFixed(1)} كيلوواط عند الظهيرة`
                        : `Peak about ${peakKw.toFixed(1)} kW around noon`
                      : ''}
                  </text>
                </svg>
              </div>

              <div className="mt-3 text-xs text-[#b9bdcf]">
                <span className="tag-pill mr-2">simulated shape</span>
                {isAr
                  ? `منحنى القدرة الساعي ونطاق عدم اليقين P10–P90 محسوبان لخلية ERA5 (${site.cellLat.toFixed(2)}°N, ${site.cellLon.toFixed(2)}°E).`
                  : `Hourly AC power curve and P10–P90 uncertainty band simulated via PVWatts + ERA5 cell (${site.cellLat.toFixed(2)}°N, ${site.cellLon.toFixed(2)}°E).`}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 8: GOLDEN HOUR BUSINESS CASE & 3-TECH COMPARISON TABLE */}
        <section
          id="business"
          ref={(el) => {
            sectionRefs.current[8] = el;
          }}
          className="relative min-h-[175vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[8] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'الساعة الذهبية · دراسة الجدوى' : 'Golden hour · the business case'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2 mb-4">
                {isAr ? 'سطحك، بالأرقام' : 'Your roof, in numbers'}
              </h2>

              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
                <div data-gsap-item className="glass">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'النظام' : 'System'}
                  </div>
                  <div className="mt-1 font-serif text-[26px] leading-[1.15] whitespace-nowrap text-white">
                    {assessment.chosen.kWp.toFixed(2)} kWp
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">
                    {assessment.chosen.panelCount} × {assessment.chosen.nameEn}
                  </div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'التكلفة' : 'Cost'}
                  </div>
                  <div className="mt-1 font-serif text-[26px] leading-[1.15] whitespace-nowrap text-white">
                    EGP {assessment.chosen.capexEgp.toLocaleString('en-US')}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">
                    {isAr ? 'شامل التركيب' : 'installed'}
                  </div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الطاقة' : 'Energy'}
                  </div>
                  <div className="mt-1 font-serif text-[26px] leading-[1.15] whitespace-nowrap text-white">
                    {assessment.chosen.annualKwh.toLocaleString('en-US')} kWh
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">
                    {isAr ? 'سنوياً' : 'per year'}
                  </div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الوفر' : 'Saving'}
                  </div>
                  <div className="mt-1 font-serif text-[26px] leading-[1.15] whitespace-nowrap text-white">
                    EGP {assessment.chosen.annualSavingEgp.toLocaleString('en-US')}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">
                    {isAr ? 'سنوياً' : 'per year'}
                  </div>
                </div>

                <div data-gsap-item className="glass">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'الاسترداد' : 'Payback'}
                  </div>
                  <div className="mt-1 font-serif text-[26px] leading-[1.15] whitespace-nowrap text-white">
                    {assessment.chosen.simplePaybackYears} {isAr ? 'سنة' : 'years'}
                  </div>
                  <div className="text-[13px] text-[#b9bdcf]">
                    {isAr ? 'استرداد بسيط' : 'simple'}
                  </div>
                </div>
              </div>

              <div
                data-gsap-item
                className="glass mt-3 flex flex-wrap items-center gap-3 py-3.5 px-4"
              >
                <span className="tag-pill">
                  {isAr ? 'تفصيل تكلفة المورد' : 'Provider Cost Breakdown'}
                </span>
                <span className="text-[14px] text-[#b9bdcf]">
                  {isAr
                    ? `تكلفة الألواح: ${assessment.chosen.itemizedCost.panelsEgp.toLocaleString('en-US')} ج.م (${assessment.chosen.panelCount} لوح × ${assessment.chosen.panelUnitPriceEgp.toLocaleString('en-US')} ج.م/لوح) · الإنفرتر والتركيب: ${(assessment.chosen.capexEgp - assessment.chosen.itemizedCost.panelsEgp).toLocaleString('en-US')} ج.م.`
                    : `Panels hardware: EGP ${assessment.chosen.itemizedCost.panelsEgp.toLocaleString('en-US')} (${assessment.chosen.panelCount} panels × EGP ${assessment.chosen.panelUnitPriceEgp.toLocaleString('en-US')}/panel) · Inverter, mounting & BOS: EGP ${(assessment.chosen.capexEgp - assessment.chosen.itemizedCost.panelsEgp).toLocaleString('en-US')}.`}
                </span>
              </div>

              <div data-gsap-item className="glass mt-3 overflow-x-auto">
                <div className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-[#b9bdcf]">
                  {isAr
                    ? 'التقنيات الثلاث على سطحك (انقر للتبديل)'
                    : 'All three technologies on your roof'}
                </div>
                <table className="w-full min-w-[540px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.16] text-[#b9bdcf]">
                      <th className="p-1.5">{isAr ? 'التكنولوجيا' : 'Technology'}</th>
                      <th className="p-1.5">{isAr ? 'الألواح' : 'Panels'}</th>
                      <th className="p-1.5">kWp</th>
                      <th className="p-1.5">{isAr ? 'سعر اللوح' : 'Panel (EGP)'}</th>
                      <th className="p-1.5">{isAr ? 'إجمالي الألواح' : 'Panels Cost'}</th>
                      <th className="p-1.5">{isAr ? 'التكلفة الكلية' : 'Turnkey (EGP)'}</th>
                      <th className="p-1.5">{isAr ? 'إنتاج / سنة' : 'kWh / yr'}</th>
                      <th className="p-1.5">{isAr ? 'الاسترداد' : 'Payback'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.allTechnologies.map((row) => {
                      const sel = row.tech === tech;
                      return (
                        <tr
                          key={row.tech}
                          onClick={() => setTech(row.tech)}
                          className={`cursor-pointer border-b border-white/[0.16] transition-colors ${
                            sel
                              ? 'bg-[#f5a524]/20 font-semibold text-white'
                              : 'text-[#f4f5fa] hover:bg-white/[0.06]'
                          }`}
                        >
                          <td className="py-2 px-1.5">
                            {isAr ? row.nameAr : row.nameEn}
                            {sel ? ' ★' : ''}
                          </td>
                          <td className="py-2 px-1.5">{row.panelCount}</td>
                          <td className="py-2 px-1.5">{row.kWp.toFixed(2)}</td>
                          <td className="py-2 px-1.5">{row.panelUnitPriceEgp.toLocaleString('en-US')}</td>
                          <td className="py-2 px-1.5 text-[#ffd166]">
                            {row.itemizedCost.panelsEgp.toLocaleString('en-US')}
                          </td>
                          <td className="py-2 px-1.5">{row.capexEgp.toLocaleString('en-US')}</td>
                          <td className="py-2 px-1.5">{row.annualKwh.toLocaleString('en-US')}</td>
                          <td className="py-2 px-1.5">{row.simplePaybackYears} y</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-[#b9bdcf]">
                <span className="tag-pill mr-2">simulated estimate</span>
                {isAr
                  ? 'الأرقام تستجيب لاختيار اللوح والمساحة والميزانية والموقع وفق افتراضات أسعار وتعريفة موثقة.'
                  : `Engineering estimates (${assessment.assumptions.version}) responding live to your panel, location, roof, and budget choices.`}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 9: DUSK SUNSET */}
        <section
          id="dusk"
          ref={(el) => {
            sectionRefs.current[9] = el;
          }}
          className="relative min-h-[260vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[9] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[640px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'الغسق' : 'Dusk'}
                </div>
                <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3.5">
                  {isAr
                    ? 'ثم تغرب الشمس، وتتوقف ألواحك عن التوليد.'
                    : 'Then the sun goes down, and your panels stop.'}
                </h2>
                <p data-gsap-item className="cinematic-lede mb-5">
                  {isAr
                    ? 'تستهلك معظم المنازل أكبر قدر من الكهرباء في المساء. ما تفعله حيال ذلك يقرر كم ستستفيد فعلياً من طاقتك الشمسية.'
                    : 'Most homes use the most electricity in the evening. What you do about that decides how much of your own solar you actually use.'}
                </p>
                <div
                  data-gsap-item
                  className="font-mono text-xs uppercase tracking-[0.16em] text-white/85"
                >
                  {isAr ? 'واصل التمرير ↓' : 'Keep scrolling ↓'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 10: NIGHT ENHANCERS & CALL TO ACTION */}
        <section
          id="night"
          ref={(el) => {
            sectionRefs.current[10] = el;
          }}
          className="relative min-h-[260vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[10] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'الليل · اجعلها تعمل بعد الغروب' : 'Night · make it work after dark'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-4">
                {isAr ? 'احتفظ بالشمس لوقت لاحق' : 'Keep the sun for later'}
              </h2>

              <div data-gsap-item className="glass">
                <ul className="m-0 grid list-none gap-3 p-0">
                  {assessment.enhancers.slice(0, 4).map((enh) => (
                    <li
                      key={enh.id}
                      className="flex flex-col gap-1 border-b border-white/[0.1] pb-2.5 last:border-none last:pb-0 sm:flex-row sm:items-baseline sm:gap-4"
                    >
                      <b className="min-w-[190px] font-serif text-[19px] font-semibold text-white">
                        {isAr ? enh.titleAr : enh.titleEn}
                      </b>
                      <span className="flex-1 text-[14px] text-[#b9bdcf]">
                        {isAr ? enh.reasonAr : enh.reasonEn}
                      </span>
                      <span className="tag-pill live shrink-0">{enh.impactMetric}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div data-gsap-item className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollToChapter('dawn')}
                  className="btn-pill-primary"
                >
                  <span>{isAr ? 'ابدأ من جديد عند الفجر ↑' : 'Start again at dawn'}</span>
                </button>

                <Link href={reportHref} className="btn-pill">
                  <FileSpreadsheet className="h-4 w-4 text-[#ffd166]" />
                  <span>{isAr ? 'فتح التقرير الهندسي الكامل' : 'Open Full Report & Print'}</span>
                </Link>

                <Link
                  href={`/twin?tech=${tech}&lat=${site.cellLat}&lon=${site.cellLon}&count=${assessment.chosen.panelCount}`}
                  className="btn-pill"
                >
                  <Box className="h-4 w-4 text-[#3fc1c1]" />
                  <span>{isAr ? 'التوأم الرقمي 3D' : 'Launch 3D Digital Twin'}</span>
                </Link>

                <Link href="/app" className="btn-pill">
                  <Activity className="h-4 w-4 text-[#ffd166]" />
                  <span>{isAr ? 'الانتقال إلى التشغيل (Operate)' : 'Enter Operate Dashboard'}</span>
                </Link>

                <button type="button" onClick={handleCopyShareLink} className="btn-pill">
                  {copiedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#3fc1c1]" />
                      <span>{isAr ? 'تم نسخ الرابط!' : 'Link Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{isAr ? 'مشاركة الإعدادات' : 'Share URL'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 3D Satellite Globe Location Modal */}
      <GlobeLocationModal
        open={globeOpen}
        autoLocate={globeAutoLocate}
        initialLat={site.lat}
        initialLon={site.lon}
        isAr={isAr}
        onClose={() => setGlobeOpen(false)}
        onSelectLocation={(newSite, srcLabel) => {
          setSite(newSite);
          setLocationChosen(true);
          setLocationSource(srcLabel);
          scrollToChapter('noon', 0.35);
        }}
      />
    </div>
  );
}
