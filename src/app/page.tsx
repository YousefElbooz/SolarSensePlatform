
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Navbar, useLanguage } from '@/components/Navbar';
import { PanelThreeViewer, RooftopThreeViewer } from '@/components/SolarThreeViewers';
import { GlobeLocationModal } from '@/components/GlobeLocationModal';
import { runAssessment } from '@/domain/business';
import { PANEL_TECH_LIST, normalizePanelTech } from '@/domain/panels';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { REGIONS, snapToGridCell } from '@/domain/regions';
import { LiveWeatherObservation, PanelTech, SitePoint } from '@/domain/types';
import {
  Compass,
  MapPin,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
  Box,
  Activity,
  Share2,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ChapterDef {
  id: string;
  clip: string;
  mode: 'scrub' | 'play';
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
    from: 0.12,
    t0: 5.2,
    t1: 6.6,
    nameEn: 'Dawn · Hero',
    nameAr: 'الفجر · البداية',
  },
  {
    id: 'dunes',
    clip: 'dunes',
    mode: 'play',
    t0: 6.6,
    t1: 7.6,
    nameEn: 'Early Morning',
    nameAr: 'الصباح الباكر',
    grade: '#ffb35a',
    gradeOpacity: 0.22,
  },
  {
    id: 'why',
    clip: 'dust',
    mode: 'play',
    t0: 7.6,
    t1: 9.0,
    nameEn: 'Why It Is Hard',
    nameAr: 'لماذا التنبؤ صعب؟',
  },
  {
    id: 'panel',
    clip: 'redDune',
    mode: 'play',
    t0: 9.0,
    t1: 10.2,
    nameEn: 'Step 1 · Choose Panel',
    nameAr: 'خطوة 1 · اختر اللوح',
  },
  {
    id: 'where',
    clip: 'aswan',
    mode: 'play',
    t0: 10.2,
    t1: 11.6,
    nameEn: 'Step 2 · Location',
    nameAr: 'خطوة 2 · موقعك',
  },
  {
    id: 'noon',
    clip: 'noon',
    mode: 'play',
    t0: 11.6,
    t1: 13.0,
    nameEn: 'Noon · Live Sky',
    nameAr: 'الظهيرة · طقس موقعك الآن',
  },
  {
    id: 'space',
    clip: 'cairo',
    mode: 'play',
    t0: 13.0,
    t1: 15.0,
    nameEn: 'Step 3 · Roof & Budget',
    nameAr: 'خطوة 3 · المساحة والميزانية',
  },
  {
    id: 'predict',
    clip: 'field',
    mode: 'play',
    t0: 15.0,
    t1: 16.5,
    nameEn: 'Afternoon · Prediction',
    nameAr: 'العصر · منحنى الإنتاج',
  },
  {
    id: 'business',
    clip: 'glint',
    mode: 'play',
    t0: 16.5,
    t1: 18.0,
    nameEn: 'Golden Hour · Business Case',
    nameAr: 'الغروب الذهبي · الجدوى المالية',
    grade: '#ff9a3c',
    gradeOpacity: 0.26,
  },
  {
    id: 'dusk',
    clip: 'sunset',
    mode: 'scrub',
    t0: 18.0,
    t1: 19.5,
    nameEn: 'Dusk · Sunset',
    nameAr: 'الغسق · غروب الشمس',
  },
  {
    id: 'night',
    clip: 'stars',
    mode: 'scrub',
    t0: 19.5,
    t1: 22.8,
    nameEn: 'Night · Storage & CTA',
    nameAr: 'الليل · التخزين والتقرير',
  },
];

function formatHhMm(decimalHour: number): string {
  const h = Math.floor(decimalHour);
  const m = Math.floor((decimalHour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function PlanDayArcPage() {
  const { isAr } = useLanguage();

  // Plan flow state synced with URL query parameters
  const [tech, setTech] = useState<PanelTech>('pc-Si');
  const [site, setSite] = useState<SitePoint>(() => snapToGridCell(30.04, 31.24)); // Default Cairo
  const [locationChosen, setLocationChosen] = useState<boolean>(false);
  const [locationSource, setLocationSource] = useState<string>('Default (Cairo)');
  const [usableAreaM2, setUsableAreaM2] = useState<number>(45);
  const [budgetEgp, setBudgetEgp] = useState<number>(180000);
  const [monthlyBillEgp, setMonthlyBillEgp] = useState<number>(2400);
  const [daytimeSharePct, setDaytimeSharePct] = useState<number>(45);

  const [globeOpen, setGlobeOpen] = useState<boolean>(false);
  const [globeAutoLocate, setGlobeAutoLocate] = useState<boolean>(false);
  const [weather, setWeather] = useState<LiveWeatherObservation | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Scroll & Video Stage refs
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [clockLabel, setClockLabel] = useState<string>('05:12 · Dawn');

  // Hydrate initial state from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tech');
    if (t) setTech(normalizePanelTech(t));
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat > 20 && lon > 20) {
      setSite(snapToGridCell(lat, lon));
      setLocationChosen(true);
    }
    const area = Number(params.get('area'));
    if (!Number.isNaN(area) && area >= 10 && area <= 500) setUsableAreaM2(area);
    const budget = Number(params.get('budget'));
    if (!Number.isNaN(budget) && budget >= 40000 && budget <= 2000000) setBudgetEgp(budget);
    const bill = Number(params.get('bill'));
    if (!Number.isNaN(bill) && bill >= 300 && bill <= 100000) setMonthlyBillEgp(bill);
  }, []);

  // Sync state changes back to URL query string so any configuration is shareable
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tech', tech);
    params.set('lat', site.cellLat.toFixed(2));
    params.set('lon', site.cellLon.toFixed(2));
    params.set('area', String(usableAreaM2));
    params.set('budget', String(budgetEgp));
    params.set('bill', String(monthlyBillEgp));
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [tech, site.cellLat, site.cellLon, usableAreaM2, budgetEgp, monthlyBillEgp]);

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
        monthlyBillEgp,
        daytimeSharePct,
      }),
    [tech, site.cellLat, site.cellLon, usableAreaM2, budgetEgp, monthlyBillEgp, daytimeSharePct]
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

  // Scroll-driven video cross-fading and time-lapse scrubbing
  useEffect(() => {
    const uniqueClips = Array.from(new Set(CHAPTERS.map((c) => c.clip)));
    // Preload first 2 chapters immediately
    ['sunrise', 'dunes', 'dust'].forEach((clipKey) => {
      const v = videoRefs.current[clipKey];
      if (v && !v.src) {
        v.src = `/footage/web/${clipKey}.mp4`;
        v.load();
      }
    });

    let rafId = 0;
    const onFrame = () => {
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

      setActiveIdx(currentIdx);
      const ch = CHAPTERS[currentIdx];
      const nextCh = CHAPTERS[currentIdx + 1];
      const rect = rects[currentIdx];

      // Ensure neighboring video clips are loaded
      [currentIdx - 1, currentIdx, currentIdx + 1].forEach((idx) => {
        const c = CHAPTERS[idx];
        if (!c) return;
        const v = videoRefs.current[c.clip];
        if (v && !v.src) {
          v.src = `/footage/web/${c.clip}.mp4`;
          v.load();
        }
      });

      const progress = rect
        ? Math.max(0, Math.min(1, (mid - rect.top) / Math.max(1, rect.height)))
        : 0;
      const clockTime = ch.t0 + (ch.t1 - ch.t0) * progress;
      setClockLabel(
        `${formatHhMm(clockTime)} · ${isAr ? ch.nameAr : ch.nameEn}`
      );

      // Compute smooth blend to next chapter over last 50% of viewport
      const nextRect = rects[currentIdx + 1];
      let blend = 0;
      if (nextRect) {
        const t = Math.max(0, Math.min(1, (nextRect.top - mid) / (vh * 0.5)));
        blend = 1 - t * t * (3 - 2 * t);
      }

      uniqueClips.forEach((clipKey) => {
        const v = videoRefs.current[clipKey];
        if (!v) return;
        const opacity =
          clipKey === ch.clip ? 1 : nextCh && clipKey === nextCh.clip ? blend : 0;
        v.style.opacity = String(opacity);

        const owner = clipKey === ch.clip ? ch : nextCh;
        const shouldPlay = opacity > 0.02 && owner?.mode === 'play';
        if (shouldPlay && v.paused) {
          v.play().catch(() => {});
        } else if (!shouldPlay && !v.paused) {
          v.pause();
        }
      });

      // Scrub time-lapse chapters (dawn sunrise, dusk sunset, night stars)
      if (ch.mode === 'scrub') {
        const v = videoRefs.current[ch.clip];
        if (v && v.readyState >= 1 && Number.isFinite(v.duration)) {
          const from = ch.from || 0;
          const targetTime = (from + (1 - from) * progress) * (v.duration - 0.08);
          if (!v.seeking && Math.abs(v.currentTime - targetTime) > 0.05) {
            v.currentTime = targetTime;
          }
        }
      }

      rafId = requestAnimationFrame(onFrame);
    };

    rafId = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(rafId);
  }, [isAr]);

  const scrollToChapter = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const activeChapter = CHAPTERS[activeIdx] || CHAPTERS[0];
  const regionInfo = REGIONS[site.region];
  const uniqueClips = useMemo(() => Array.from(new Set(CHAPTERS.map((c) => c.clip))), []);

  // SVG Forecast Curve coordinates
  const maxChartKw = Math.max(1, assessment.chosen.kWp);
  const svgPoints = forecast.points.map((pt, idx) => {
    const x = 50 + (idx / Math.max(1, forecast.points.length - 1)) * 700;
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
  const areaFillPath = `${meanPath} L750 190 L50 190 Z`;
  const bandPath =
    svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.yP90.toFixed(1)}`).join(' ') +
    ' ' +
    [...svgPoints]
      .reverse()
      .map((p) => `L${p.x.toFixed(1)} ${p.yP10.toFixed(1)}`)
      .join(' ') +
    ' Z';

  const reportHref = `/report/${assessment.id}?tech=${tech}&lat=${site.cellLat}&lon=${site.cellLon}&area=${usableAreaM2}&budget=${budgetEgp}&bill=${monthlyBillEgp}`;

  return (
    <div className="relative min-h-screen">
      <Navbar clockLabel={clockLabel} />

      {/* Fixed Film Backdrop Stage */}
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
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300"
          />
        ))}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-all duration-1000"
          style={{
            backgroundColor: activeChapter.grade || 'transparent',
            opacity: activeChapter.gradeOpacity || 0,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,7,15,0.68) 0%, rgba(5,7,15,0.22) 28%, rgba(5,7,15,0.38) 56%, rgba(5,7,15,0.85) 100%)',
          }}
        />
      </div>

      {/* Right-hand Progress Rail (Dawn -> Night) */}
      <aside
        className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 lg:flex"
        aria-label="Day Arc Chapters"
      >
        {CHAPTERS.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => scrollToChapter(ch.id)}
            title={isAr ? ch.nameAr : ch.nameEn}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              idx === activeIdx
                ? 'scale-125 bg-amber-400 ring-4 ring-amber-400/25'
                : 'bg-white/35 hover:bg-white/75'
            }`}
          />
        ))}
      </aside>

      {/* Main Scroll Chapters */}
      <main className="relative z-10">
        {/* CHAPTER 1: DAWN HERO */}
        <section
          id="dawn"
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="relative min-h-[210vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-20 pt-24">
            <div className="mx-auto w-full max-w-6xl">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  {isAr ? 'سولار سينس · مصر · يوم كامل مع الشمس' : 'SolarSense · Egypt · One Day of Sun'}
                </div>
                <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.06] text-white drop-shadow-lg sm:text-6xl">
                  {isAr
                    ? 'اعرف ما ستمنحه لك الشمس قبل أن تشتري لوحاً واحداً.'
                    : 'Know what the sun will give you before you buy a single panel.'}
                </h1>
                <p className="mt-4 max-w-xl text-base text-slate-200/95 sm:text-lg">
                  {isAr
                    ? 'اختر تكنولوجيا اللوح، حدد موقعك في أقاليم مصر المناخية الأربعة، وشاهد الإنتاج المتوقع والتكلفة وفترة الاسترداد بدقة فيزيائية.'
                    : 'Inspect three solar technologies in 3D, locate your 25 km climate cell on the satellite globe, and see your live sky, roof layout, power curve, and 25-year payback.'}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToChapter('panel')}
                    className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
                  >
                    {isAr ? 'ابدأ رحلة التخطيط ↓' : 'Start planning your roof ↓'}
                  </button>
                  <Link
                    href={reportHref}
                    className="rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:border-amber-400"
                  >
                    {isAr ? 'معاينة التقرير المالي المباشر' : 'Open instant financial report'}
                  </Link>
                  <Link
                    href="/app"
                    className="rounded-full border border-teal-400/40 bg-teal-500/15 px-5 py-3 text-sm font-medium text-teal-200 backdrop-blur-md transition hover:bg-teal-500/25"
                  >
                    {isAr ? 'لوحة تشغيل المحطات (Operate)' : 'Operator Dashboard (Operate)'}
                  </Link>
                </div>
                <div className="mt-8 text-xs uppercase tracking-[0.18em] text-amber-200/80">
                  {isAr ? 'مرر للأسفل لترفع الشمس في السماء ↓' : 'Scroll to raise the sun over the desert ↓'}
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
          className="relative min-h-[140vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-20 pt-24">
            <div className="mx-auto w-full max-w-6xl">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  {isAr ? 'الصباح الباكر · إمكانات مصر الشمسية' : '06:45 · Early Morning'}
                </div>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-5xl">
                  {isAr
                    ? 'تمتلك مصر سطوعاً شمسياً يفوق معظم بقاع الأرض.'
                    : 'Egypt has more sun than almost anywhere on Earth.'}
                </h2>
                <p className="mt-4 text-base text-slate-200 sm:text-lg">
                  {isAr
                    ? 'أكثر من 11 ساعة إشعاع يومياً، ومستهدف وطني للوصول إلى 42% طاقة متجددة بحلول 2030. التحدي ليس وجود الشمس، بل حساب ما سينتجه سطحك أنت تحديداً.'
                    : 'Up to eleven hours a day and a 42% national renewable target by 2030. The hard part was never whether the sun shines—it is knowing how much of it your specific panels will turn into power on your roof.'}
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
          className="relative min-h-[150vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-24">
            <div className="mx-auto w-full max-w-6xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {isAr ? 'الصباح · فيزياء الغلاف الجوي' : '08:00 · Why Solar Forecasting Is Hard'}
              </div>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-5xl">
                {isAr ? 'حركة الشمس حتمية. أما حالة السماء فلا.' : 'Sun geometry is predictable. The sky is not.'}
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-5 backdrop-blur-xl">
                  <div className="font-serif text-xl font-semibold text-amber-300">
                    {isAr ? '1. غبار الخماسين والعوالق' : '1. Khamaseen Dust & Aerosols'}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {isAr
                      ? 'تخفض العواصف الترابية الربيعية الإشعاع الكلي (GHI) بنسبة تصل إلى 13% والإشعاع المباشر (DNI) حتى 41%، وتترك طبقة غبار على الزجاج.'
                      : 'Spring Khamaseen dust plumes cut GHI by up to ~13% and direct normal irradiance (DNI) by up to ~41% climatologically, leaving a soiling film on glass.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-5 backdrop-blur-xl">
                  <div className="font-serif text-xl font-semibold text-amber-300">
                    {isAr ? '2. الفقد الحراري للخلايا (γ)' : '2. Cell Thermal Derating (γ)'}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {isAr
                      ? 'تتجاوز حرارة الألواح في الصعيد 60°م. كل درجة فوق 25°م تخصم من القدرة حسب المعامل الحراري لنوع اللوح.'
                      : 'Summer panels in Upper Egypt exceed 60°C. Every degree above 25°C costs output according to your module’s temperature coefficient γ.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-5 backdrop-blur-xl">
                  <div className="font-serif text-xl font-semibold text-amber-300">
                    {isAr ? '3. أربعة أقاليم مناخية مختلفة' : '3. Four Distinct Egyptian Skies'}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {isAr
                      ? 'الساحل الشمالي والدلتا، الصحراء الغربية، سيناء والبحر الأحمر، ووادي النيل والصعيد: لكل إقليم لوح أمثل مختلف.'
                      : 'North Coast & Delta, Western Desert, Sinai & Red Sea, and Nile Valley & Upper Egypt each demand a different optimal module technology.'}
                  </p>
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
          className="relative min-h-[165vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {isAr ? 'منتصف الصباح · الخطوة 1' : '09:30 · Step 1: Choose Your Panel Technology'}
                  </div>
                  <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-4xl">
                    {isAr ? 'ثلاث تقنيات لالتقاط نفس الضوء' : 'Three ways to catch the same light'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToChapter('where')}
                  className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  <span>{isAr ? 'التالي: حدد موقعك' : 'Continue to location'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-5 grid items-center gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/65 p-3 backdrop-blur-xl lg:col-span-5">
                  <PanelThreeViewer tech={tech} isAr={isAr} heightClass="h-[370px]" />
                </div>

                <div className="grid gap-3.5 lg:col-span-7">
                  {PANEL_TECH_LIST.map((item) => {
                    const selected = item.key === tech;
                    const recForRegion = regionInfo.recommendedTech === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTech(item.key)}
                        className={`w-full rounded-2xl border p-4 text-left transition backdrop-blur-xl ${
                          selected
                            ? 'border-amber-400 bg-amber-950/45 shadow-lg shadow-amber-500/10'
                            : 'border-white/15 bg-[#0a0d1c]/70 hover:border-white/35'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-serif text-xl font-semibold text-white">
                              {isAr ? item.nameAr : item.nameEn}
                            </h3>
                            <div className="text-xs text-slate-300">
                              {isAr ? item.subtitleAr : item.subtitleEn}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {recForRegion && (
                              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-medium text-teal-300">
                                {isAr ? `الأنسب لإقليم ${regionInfo.code}` : `Best for ${regionInfo.code}`}
                              </span>
                            )}
                            {selected && (
                              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-slate-950">
                                {isAr ? 'محدد ✓' : 'Selected ✓'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-white/10 pt-2.5 text-xs sm:grid-cols-4">
                          <div>
                            <span className="text-slate-400">{isAr ? 'الكفاءة' : 'Efficiency'}</span>
                            <div className="font-semibold text-white">{item.efficiencyRange}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">{isAr ? 'الفقد الحراري γ' : 'Heat coeff γ'}</span>
                            <div className="font-semibold text-amber-300">{item.tempCoeffRange}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">{isAr ? 'المساحة / ك.و' : 'Roof / kWp'}</span>
                            <div className="font-semibold text-white">{item.areaPerKwpLabel}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">{isAr ? 'الفئة السعرية' : 'Price tier'}</span>
                            <div className="font-semibold text-white">
                              {item.priceTier} ({item.panelWp} Wp)
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <div className="text-[11px] text-slate-400">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                      Assumption
                    </span>{' '}
                    {isAr
                      ? 'القيم تمثل النطاقات القياسية للتقنيات الثلاث وتتم مقارنة الثلاثة معاً على سطحك في الفصل الثامن.'
                      : 'Textbook module parameters; Chapter 8 compares all three side-by-side on your exact roof.'}
                  </div>
                </div>
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
          className="relative min-h-[155vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  {isAr ? 'الضحى · الخطوة 2: الموقع والأقاليم الأربعة' : '10:45 · Step 2: Where in Egypt Are You?'}
                </div>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-5xl">
                  {isAr ? 'كل سماء في مصر لها بصمتها. أيّها سماؤك؟' : 'Every sky in Egypt is different. Which one is yours?'}
                </h2>
                <p className="mt-3 text-base text-slate-200">
                  {isAr
                    ? 'نطابق موقعك مع خلية بيانات ERA5 (بدقة 0.25° × 0.25° من إجمالي 990 خلية تغطي مصر) ونحدد إقليمك المناخي.'
                    : 'We match your position to one of the 990 ERA5 reanalysis grid cells (0.25° × 0.25°, ~25 km) and classify your climate region.'}
                </p>

                <div className="mt-6 rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-5 backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">
                        {isAr ? 'الموقع المحدد حالياً' : 'Active Site & Climate Region'}
                      </div>
                      <div className="mt-1 font-serif text-2xl font-semibold text-white">
                        {site.anchorName ? `${site.anchorName} · ` : ''}
                        {isAr ? regionInfo.nameAr : regionInfo.nameEn}{' '}
                        <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 font-sans text-xs text-teal-300">
                          {regionInfo.code}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        ERA5 Cell: <b>{site.cellLat.toFixed(2)}° N, {site.cellLon.toFixed(2)}° E</b> ·{' '}
                        {locationSource} ·{' '}
                        {site.inCoverage
                          ? isAr
                            ? 'ضمن التغطية المباشرة'
                            : 'Inside archive coverage'
                          : isAr
                            ? `أقرب خلية (${site.distanceKm} كم)`
                            : `Snapped to nearest cell (${site.distanceKm} km)`}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setGlobeAutoLocate(true);
                          setGlobeOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
                      >
                        <Compass className="h-4 w-4" />
                        <span>{isAr ? 'حدد موقعي تلقائياً' : 'Find my location'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGlobeAutoLocate(false);
                          setGlobeOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-medium text-white hover:border-amber-400"
                      >
                        <MapPin className="h-4 w-4 text-amber-400" />
                        <span>{isAr ? 'اختر على الكرة الأرضية 3D' : 'Choose on 3D Globe'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-300">
                    <b className="text-amber-300">
                      {isAr ? 'تأثير الإقليم على الألواح:' : 'Regional PV Impact:'}
                    </b>{' '}
                    {isAr ? regionInfo.pvBehaviourAr : regionInfo.pvBehaviourEn}
                  </div>
                </div>
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
          className="relative min-h-[150vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {isAr ? 'الظهيرة · سماء موقعك الآن' : '12:00 Noon · Your Sky Right Now'}
                  </div>
                  <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
                    {isAr ? 'هذا ما يراه نموذج التنبؤ في هذه اللحظة.' : 'This is what the model sees.'}
                  </h2>
                </div>
                <span className="rounded-full border border-teal-400/40 bg-teal-500/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-teal-200">
                  {weatherLoading
                    ? isAr
                      ? 'جاري جلب الطقس الحي...'
                      : 'Fetching Open-Meteo...'
                    : weather?.provider === 'open-meteo-live'
                      ? isAr
                        ? 'بيانات حية · Open-Meteo IFS'
                        : 'Live · Open-Meteo IFS Feed'
                      : isAr
                        ? 'وضع محاكاة ERA5'
                        : 'ERA5 Reference Mode'}
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                {isAr
                  ? 'نفس المتغيرات الفيزيائية التي تدرب عليها النموذج في أرشيف ERA5، مقروءة مباشرة لخليتك المناخية.'
                  : 'The exact meteorological variables our ERA5 → pvlib pipeline uses, read live for your 0.25° grid cell.'}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الإشعاع الكلي (ssrd / GHI)' : 'Global Sunlight (ssrd / GHI)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-amber-300">
                    {weather ? weather.shortwaveRadiationWm2 : '–'}
                  </div>
                  <div className="text-xs text-slate-400">W/m²</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الإشعاع المباشر (fdir)' : 'Direct Radiation (fdir)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? weather.directRadiationWm2 : '–'}
                  </div>
                  <div className="text-xs text-slate-400">W/m²</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'درجة حرارة الهواء (t2m)' : 'Air Temperature (t2m)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? weather.temperature2mC : '–'}
                  </div>
                  <div className="text-xs text-slate-400">°C</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'سرعة الرياح (u10, v10)' : '10m Wind Speed (ws10)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? weather.windSpeed10mKmh : '–'}
                  </div>
                  <div className="text-xs text-slate-400">km/h (panel cooling)</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الغطاء السحابي (tcc)' : 'Cloud Cover (tcc)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? weather.cloudCoverPct : '–'}
                  </div>
                  <div className="text-xs text-slate-400">%</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الرطوبة النسبية / نقطة الندى' : 'Humidity / Dewpoint (d2m)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? `${weather.relativeHumidityPct}%` : '–'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {weather ? `Dewpoint ${weather.dewPoint2mC}°C` : ''}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الضغط الجوي (sp)' : 'Surface Pressure (sp)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-white">
                    {weather ? weather.surfacePressureHpa : '–'}
                  </div>
                  <div className="text-xs text-slate-400">hPa</div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/75 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'مؤشر الغبار والعوالق (AOD)' : 'Dust / Aerosol Index (AOD)'}
                  </div>
                  <div className="mt-1 font-serif text-3xl font-semibold text-teal-300">
                    {weather ? weather.dustAod : '–'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {regionInfo.dustRisk} {isAr ? 'خطر الغبار' : 'dust profile'}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                {weather
                  ? `${site.anchorName || 'Grid Cell'} (${site.cellLat.toFixed(2)}° N, ${site.cellLon.toFixed(2)}° E) · ${weather.timestamp} Africa/Cairo.`
                  : ''}{' '}
                {!locationChosen &&
                  (isAr
                    ? 'يُعرض طقس القاهرة افتراضياً حتى تختار موقعاً آخر.'
                    : 'Showing Cairo by default until you pick another site.')}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 6: SPACE, BUDGET & 3D ROOFTOP CONFIGURATOR */}
        <section
          id="space"
          ref={(el) => {
            sectionRefs.current[6] = el;
          }}
          className="relative min-h-[165vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {isAr ? 'بداية العصر · الخطوة 3: المساحة والميزانية' : '13:30 · Step 3: Your Roof Space & Budget'}
                  </div>
                  <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-4xl">
                    {isAr ? 'كم مساحة سطحك، وما هي ميزانيتك؟' : 'How much roof, and how much budget?'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToChapter('business')}
                  className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  <span>{isAr ? 'اعرض الجدوى المالية ←' : 'See business case →'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-5 grid items-center gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/70 p-3 backdrop-blur-xl lg:col-span-6">
                  <RooftopThreeViewer
                    tech={tech}
                    panelCount={assessment.chosen.panelCount}
                    areaM2={usableAreaM2}
                    tiltDeg={Math.round(site.cellLat * 0.9)}
                    isAr={isAr}
                    heightClass="h-[380px]"
                  />
                </div>

                <div className="grid gap-3.5 lg:col-span-6">
                  <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                    <div className="flex justify-between text-xs text-slate-300">
                      <label htmlFor="area-slider">
                        {isAr ? 'مساحة السطح المتاحة (م²)' : 'Usable Roof Area (m²)'}
                      </label>
                      <span className="font-serif text-xl font-semibold text-amber-300">
                        {usableAreaM2} m²
                      </span>
                    </div>
                    <input
                      id="area-slider"
                      type="range"
                      min={15}
                      max={250}
                      step={5}
                      value={usableAreaM2}
                      onChange={(e) => setUsableAreaM2(Number(e.target.value))}
                      className="mt-2 w-full accent-amber-500"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                    <div className="flex justify-between text-xs text-slate-300">
                      <label htmlFor="budget-slider">
                        {isAr ? 'الميزانية المتاحة (جنيه مصري)' : 'Target Budget (EGP)'}
                      </label>
                      <span className="font-serif text-xl font-semibold text-amber-300">
                        EGP {budgetEgp.toLocaleString()}
                      </span>
                    </div>
                    <input
                      id="budget-slider"
                      type="range"
                      min={50000}
                      max={800000}
                      step={10000}
                      value={budgetEgp}
                      onChange={(e) => setBudgetEgp(Number(e.target.value))}
                      className="mt-2 w-full accent-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-3.5 backdrop-blur-xl">
                      <div className="flex justify-between text-xs text-slate-300">
                        <label htmlFor="bill-slider">
                          {isAr ? 'الفاتورة الشهرية' : 'Monthly Bill'}
                        </label>
                        <span className="font-semibold text-white">
                          EGP {monthlyBillEgp.toLocaleString()}
                        </span>
                      </div>
                      <input
                        id="bill-slider"
                        type="range"
                        min={500}
                        max={20000}
                        step={250}
                        value={monthlyBillEgp}
                        onChange={(e) => setMonthlyBillEgp(Number(e.target.value))}
                        className="mt-2 w-full accent-amber-500"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-3.5 backdrop-blur-xl">
                      <div className="flex justify-between text-xs text-slate-300">
                        <label htmlFor="daytime-slider">
                          {isAr ? 'الاستهلاك النهاري' : 'Daytime Use Share'}
                        </label>
                        <span className="font-semibold text-white">{daytimeSharePct}%</span>
                      </div>
                      <input
                        id="daytime-slider"
                        type="range"
                        min={20}
                        max={90}
                        step={5}
                        value={daytimeSharePct}
                        onChange={(e) => setDaytimeSharePct(Number(e.target.value))}
                        className="mt-2 w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-400/40 bg-amber-950/40 p-4 backdrop-blur-xl">
                    <div className="text-xs uppercase tracking-wider text-amber-300">
                      {isAr ? 'النظام المتوافق مع سطحك وميزانيتك' : 'Fits Your Roof & Budget'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-serif text-3xl font-semibold text-white">
                        {assessment.chosen.panelCount} {isAr ? 'لوح' : 'panels'} ·{' '}
                        <span className="text-amber-300">{assessment.chosen.kWp} kWp</span>
                      </div>
                      <span className="rounded-full bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-200">
                        {isAr ? 'الحد الحاكم:' : 'Binding limit:'}{' '}
                        {assessment.chosen.bindingLimit.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
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
          className="relative min-h-[150vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {isAr ? 'العصر · منحنى القدرة المتوقع' : '15:30 · Afternoon: Your Day of Power'}
                  </div>
                  <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
                    {isAr ? 'منحنى التوليد الساعي مع نطاق عدم اليقين (P10–P90)' : 'Hourly output curve with P10–P90 uncertainty band'}
                  </h2>
                </div>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
                  {isAr ? 'تقدير فيزيائي محاكي (PVWatts + الأطلس)' : 'Simulated Estimate · PVWatts + Yield Atlas'}
                </span>
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-5 backdrop-blur-xl">
                <svg
                  viewBox="0 0 800 225"
                  className="w-full h-auto overflow-visible"
                  role="img"
                  aria-label="Hourly solar power curve with P10-P90 uncertainty band and clear-sky envelope"
                >
                  <defs>
                    <linearGradient id="powerGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f5a524" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#f5a524" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[50, 95, 140, 190].map((y) => (
                    <line
                      key={y}
                      x1="50"
                      x2="750"
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                    />
                  ))}
                  {/* P10-P90 Band */}
                  <path d={bandPath} fill="rgba(63, 193, 193, 0.22)" />
                  {/* Area under expected curve */}
                  <path d={areaFillPath} fill="url(#powerGrad)" />
                  {/* Clear-sky dashed reference */}
                  <path
                    d={clearPath}
                    fill="none"
                    stroke="#3fc1c1"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                  {/* Expected AC power curve */}
                  <path d={meanPath} fill="none" stroke="#ffd166" strokeWidth="3.5" />

                  {/* X-axis labels */}
                  <g fill="#b9bdcf" fontSize="12">
                    <text x="50" y="212">05:00</text>
                    <text x="225" y="212">09:00</text>
                    <text x="400" y="212" textAnchor="middle">12:00 Noon</text>
                    <text x="575" y="212">15:00</text>
                    <text x="730" y="212">19:00</text>
                  </g>
                </svg>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-3 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <i className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
                      {isAr ? 'التوليد المتوقع (kW)' : 'Expected AC Power (kW)'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="inline-block h-2.5 w-2.5 rounded-full bg-teal-400/50" />
                      {isAr ? 'نطاق الثقة P10–P90' : 'P10–P90 Uncertainty Band'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="inline-block h-0.5 w-4 bg-teal-400" />
                      {isAr ? 'سقف السماء الصافية (P_clear)' : 'Clear-Sky Envelope (P_clear)'}
                    </span>
                  </div>
                  <div>
                    {isAr ? 'الإنتاج السنوي المتوقع:' : 'Annual Yield:'}{' '}
                    <b className="text-amber-300">
                      {assessment.chosen.annualKwh.toLocaleString()} kWh/yr
                    </b>{' '}
                    ({assessment.chosen.specificYield} kWh/kWp · PR{' '}
                    {Math.round(assessment.chosen.performanceRatio * 100)}%)
                  </div>
                </div>
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
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {isAr ? 'الساعة الذهبية · دراسة الجدوى والمقارنة' : '17:00 Golden Hour · The Business Case'}
              </div>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
                {isAr ? 'سطحك بالأرقام: مقارنة التقنيات الثلاث' : 'Your roof, in numbers'}
              </h2>

              {/* 5 Top KPIs */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'حجم النظام' : 'System Size'}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-white">
                    {assessment.chosen.kWp} kWp
                  </div>
                  <div className="text-xs text-slate-400">
                    {assessment.chosen.panelCount} × {assessment.chosen.tech}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'التكلفة الإجمالية' : 'Installed Cost'}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-amber-300">
                    EGP {assessment.chosen.capexEgp.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isAr ? 'شامل الإنفرتر والتركيب' : 'Turnkey CAPEX'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الإنتاج السنوي' : 'Annual Energy'}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-white">
                    {assessment.chosen.annualKwh.toLocaleString()} kWh
                  </div>
                  <div className="text-xs text-teal-300">
                    {isAr
                      ? `يغطي ${assessment.chosen.billCoveragePct}% من فاتورتك`
                      : `Covers ${assessment.chosen.billCoveragePct}% of bill`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'الوفر السنوي' : 'Annual Saving'}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-emerald-300">
                    EGP {assessment.chosen.annualSavingEgp.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400">
                    {assessment.chosen.co2AvoidedKgYear.toLocaleString()} kg CO₂/yr
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'فترة الاسترداد' : 'Simple Payback'}
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-amber-300">
                    {assessment.chosen.simplePaybackYears} {isAr ? 'سنوات' : 'years'}
                  </div>
                  <div className="text-xs text-slate-400">
                    25-yr NPV: EGP {assessment.chosen.npv25YrEgp.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Binding Limit Banner */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/35 bg-[#0a0d1c]/85 px-4 py-3 text-xs backdrop-blur-xl">
                <span className="rounded-full bg-amber-500 px-3 py-1 font-bold uppercase text-slate-950">
                  {assessment.chosen.bindingLimit === 'area'
                    ? isAr
                      ? 'المساحة هي الحد الحاكم'
                      : 'Roof Area Is Your Limit'
                    : assessment.chosen.bindingLimit === 'budget'
                      ? isAr
                        ? 'الميزانية هي الحد الحاكم'
                        : 'Budget Is Your Limit'
                      : isAr
                        ? 'الاستهلاك هو الحد الحاكم'
                        : 'Demand Is Your Limit'}
                </span>
                <span className="text-slate-200">
                  {assessment.chosen.bindingLimit === 'area'
                    ? isAr
                      ? `لديك فائض في الميزانية ولكن مساحة السطح (${usableAreaM2} م²) امتلأت. اختيار لوح أعلى كفاءة (HJT) يمنحك قدرة أكبر في نفس المساحة.`
                      : `Your ${usableAreaM2} m² roof fills up before your budget runs out. Choosing a higher-efficiency panel (HJT) fits more kWp in the same footprint.`
                    : isAr
                      ? `لديك مساحة سطح إضافية. اختيار لوح أقل تكلفة لكل واط (pc-Si) يعظم القدرة ضمن ميزانيتك.`
                      : `You have spare roof area. Choosing a lower cost-per-Wp module (Polycrystalline) maximizes kWp within your budget.`}
                </span>
              </div>

              {/* Side-by-side 3-Technology Comparison Table + Monthly Bars */}
              <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <div className="overflow-x-auto rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl lg:col-span-8">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-serif text-base font-semibold text-white">
                      {isAr
                        ? 'مقارنة التقنيات الثلاث جنباً إلى جنب على سطحك'
                        : 'All Three Panel Technologies on This Exact Roof'}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {isAr ? 'انقر على أي صف للتبديل' : 'Click any row to switch'}
                    </span>
                  </div>
                  <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/15 text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="py-2 pr-2">{isAr ? 'التكنولوجيا' : 'Technology'}</th>
                        <th className="py-2 px-2 text-right">{isAr ? 'الألواح' : 'Panels'}</th>
                        <th className="py-2 px-2 text-right">kWp</th>
                        <th className="py-2 px-2 text-right">{isAr ? 'التكلفة (EGP)' : 'Cost (EGP)'}</th>
                        <th className="py-2 px-2 text-right">{isAr ? 'إنتاج/سنة' : 'kWh / yr'}</th>
                        <th className="py-2 px-2 text-right">{isAr ? 'الاسترداد' : 'Payback'}</th>
                        <th className="py-2 pl-2 text-right">{isAr ? 'الحد' : 'Limit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.allTechnologies.map((row) => {
                        const isSelected = row.tech === tech;
                        return (
                          <tr
                            key={row.tech}
                            onClick={() => setTech(row.tech)}
                            className={`cursor-pointer border-b border-white/10 transition ${
                              isSelected
                                ? 'bg-amber-500/20 font-semibold text-white'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <td className="py-2.5 pr-2">
                              <span>{isAr ? row.nameAr : row.nameEn}</span>
                              {row.isRecommendedForRegion && (
                                <span className="ml-1.5 rounded-full bg-teal-500/25 px-2 py-0.5 text-[10px] text-teal-300">
                                  {isAr ? 'موصى به للإقليم' : 'Region Pick'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right">{row.panelCount}</td>
                            <td className="py-2.5 px-2 text-right">{row.kWp.toFixed(2)}</td>
                            <td className="py-2.5 px-2 text-right">
                              {row.capexEgp.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {row.annualKwh.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {row.simplePaybackYears} yr
                            </td>
                            <td className="py-2.5 pl-2 text-right uppercase">
                              {row.bindingLimit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/80 p-4 backdrop-blur-xl lg:col-span-4">
                  <h3 className="font-serif text-base font-semibold text-white">
                    {isAr ? 'الإنتاج الشهري (kWh)' : 'Monthly Energy Yield (kWh)'}
                  </h3>
                  <div className="mt-3 flex h-32 items-end gap-1.5">
                    {assessment.chosen.monthlyKwh.map((val, mIdx) => {
                      const maxM = Math.max(1, ...assessment.chosen.monthlyKwh);
                      const pct = Math.max(12, Math.round((val / maxM) * 100));
                      return (
                        <div
                          key={mIdx}
                          className="flex flex-1 flex-col items-center gap-1"
                          title={`Month ${mIdx + 1}: ${val.toLocaleString()} kWh`}
                        >
                          <div
                            className="w-full rounded-t bg-gradient-to-t from-amber-600 to-amber-300"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
                    {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
                      <span key={i} className="flex-1 text-center">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 9A: DUSK SUNSET */}
        <section
          id="dusk"
          ref={(el) => {
            sectionRefs.current[9] = el;
          }}
          className="relative min-h-[180vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-20 pt-24">
            <div className="mx-auto w-full max-w-6xl">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  {isAr ? 'الغسق · غروب الشمس' : '18:30 · Dusk'}
                </div>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-5xl">
                  {isAr
                    ? 'ثم تغرب الشمس، وتتوقف الألواح عن التوليد.'
                    : 'Then the sun goes down, and your panels stop.'}
                </h2>
                <p className="mt-4 text-base text-slate-200 sm:text-lg">
                  {isAr
                    ? 'تستهلك معظم المنازل والمنشآت ذروة طاقتها في المساء. ما تفعله بفائض الظهيرة يحدد كم ستستفيد فعلياً من نظامك الشمسي.'
                    : 'Most Egyptian homes and clinics use their peak electricity in the evening. How you handle that gap decides how much of your own solar you actually keep.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 9B & 10: NIGHT ENHANCERS & CALL TO ACTION */}
        <section
          id="night"
          ref={(el) => {
            sectionRefs.current[10] = el;
          }}
          className="relative min-h-[185vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-center px-6 py-20">
            <div className="mx-auto w-full max-w-6xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {isAr ? 'الليل · المعززات الذكية والخطوة التالية' : '21:00 Night · Smart Enhancers & Your Report'}
              </div>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
                {isAr ? 'احتفظ بالشمس لما بعد الغروب' : 'Keep the sun for after dark'}
              </h2>

              <div className="mt-6 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                {assessment.enhancers.map((enh) => (
                  <div
                    key={enh.id}
                    className={`rounded-2xl border p-4 backdrop-blur-xl ${
                      enh.recommended
                        ? 'border-amber-400/40 bg-[#0a0d1c]/85'
                        : 'border-white/15 bg-[#0a0d1c]/65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        {isAr ? enh.badgeAr : enh.badgeEn}
                      </span>
                      <span className="text-xs font-semibold text-teal-300">
                        {enh.impactMetric}
                      </span>
                    </div>
                    <h3 className="mt-2 font-serif text-lg font-semibold text-white">
                      {isAr ? enh.titleAr : enh.titleEn}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {isAr ? enh.reasonAr : enh.reasonEn}
                    </p>
                  </div>
                ))}
              </div>

              {/* Chapter 10 CTA Bar */}
              <div className="mt-8 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-[#0a0d1c]/95 via-amber-950/35 to-[#0a0d1c]/95 p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                      <Sparkles className="h-4 w-4" />
                      <span>{isAr ? 'الفجر التالي · جاهز للتنفيذ' : 'Next Dawn · Ready to Act'}</span>
                    </div>
                    <h3 className="mt-1 font-serif text-2xl font-semibold text-white">
                      {isAr
                        ? 'احفظ تقريرك المالي، أو استكشف التوأم الرقمي ولوحة التشغيل'
                        : 'Open your shareable report, launch the 3D Digital Twin, or enter Operate'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={reportHref}
                      className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{isAr ? 'فتح التقرير الكامل / PDF' : 'Open Full Report & Print'}</span>
                    </Link>

                    <Link
                      href={`/twin?tech=${tech}&lat=${site.cellLat}&lon=${site.cellLon}&count=${assessment.chosen.panelCount}`}
                      className="flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/20 px-5 py-2.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/30"
                    >
                      <Box className="h-4 w-4" />
                      <span>{isAr ? 'التوأم الرقمي ثلاثي الأبعاد' : 'Launch 3D Digital Twin'}</span>
                    </Link>

                    <Link
                      href="/app"
                      className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-medium text-white hover:border-amber-400"
                    >
                      <Activity className="h-4 w-4 text-amber-400" />
                      <span>{isAr ? 'ترقية إلى موقع تشغيل (Operate)' : 'Promote to Operate Site'}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs text-slate-200 hover:border-white/40"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{isAr ? 'تم نسخ الرابط!' : 'Link Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span>{isAr ? 'مشاركة الرابط' : 'Share Configuration URL'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    {isAr
                      ? 'قاعدة الشفافية: جميع الأرقام ناتجة عن محاكاة فيزيائية وافتراضات أسعار مرجعية موثقة وليست عرض سعر إلزامي.'
                      : 'Honesty rule: All figures carry their simulation/assumption provenance (version ' +
                        assessment.assumptions.version +
                        ') and are engineering estimates, not binding financial quotes.'}
                  </span>
                </div>
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
          scrollToChapter('noon');
        }}
      />
    </div>
  );
}
