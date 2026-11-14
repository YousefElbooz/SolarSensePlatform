'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Navbar, useLanguage } from '@/components/Navbar';
import { PanelThreeViewer } from '@/components/SolarThreeViewers';
import { GlobeLocationModal } from '@/components/GlobeLocationModal';
import {
  FEATURES_23,
  FEATURE_GROUPS,
  datasetVectorToFormVector,
  getDatasetAverageFormVector,
} from '@/domain/features';
import { PANEL_TECH_LIST } from '@/domain/panels';
import { SAVED_REGIONS, SAVED_REGION_LIST } from '@/domain/regions.config';
import {
  FeatureKey,
  FeatureProvenance,
  PanelTech,
  RegionId,
  WeatherContractResponse,
} from '@/domain/types';
import { Box, Activity, Globe2 } from 'lucide-react';

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
    t1: 8.0,
    nameEn: 'Early morning',
    nameAr: 'الصباح الباكر',
    grade: '#ffb35a',
    gradeOpacity: 0.25,
  },
  {
    id: 'why',
    clip: 'dust',
    mode: 'play',
    t0: 8.0,
    t1: 9.5,
    nameEn: 'Why it is hard',
    nameAr: 'لماذا التنبؤ صعب؟',
  },
  {
    id: 'panel',
    clip: 'redDune',
    mode: 'play',
    center: true,
    t0: 9.5,
    t1: 11.0,
    nameEn: 'Panel technologies',
    nameAr: 'تقنيات الألواح',
  },
  {
    id: 'where',
    clip: 'aswan',
    mode: 'play',
    t0: 11.0,
    t1: 12.2,
    nameEn: 'Saved regions',
    nameAr: 'الأقاليم المحفوظة',
  },
  {
    id: 'noon',
    clip: 'noon',
    mode: 'play',
    t0: 12.2,
    t1: 15.5,
    nameEn: '23 model inputs',
    nameAr: 'مدخلات النموذج (23)',
  },
  {
    id: 'dusk',
    clip: 'sunset',
    mode: 'scrub',
    long: true,
    t0: 17.5,
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

function provenanceBadgeLabel(p: FeatureProvenance, isAr: boolean): string {
  switch (p) {
    case 'api':
      return isAr ? 'API مباشر' : 'API';
    case 'calculated':
      return isAr ? 'محسوب' : 'Calculated';
    case 'default':
      return isAr ? 'متوسط البيانات' : 'Dataset average';
    case 'edited':
      return isAr ? 'مُعدّل' : 'Edited';
    case 'preset':
      return isAr ? 'نموذج جاهز' : 'Preset';
  }
}

export default function IntroLandingPage() {
  const { isAr } = useLanguage();
  const router = useRouter();

  const [tech, setTech] = useState<PanelTech>('a-Si:H/sc-Si');
  const [regionId, setRegionId] = useState<RegionId>('nile-valley-upper-egypt');
  const [globeOpen, setGlobeOpen] = useState<boolean>(false);
  const [globeAutoLocate, setGlobeAutoLocate] = useState<boolean>(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [weatherContract, setWeatherContract] = useState<WeatherContractResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const gradeRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const progress3dRef = useRef<Record<string, number>>({ panel: 0.5 });

  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [clockLabel, setClockLabel] = useState<string>('05:12 · Before dawn');

  // Fetch the 23 model inputs for the selected saved region at 10:00 UTC (12:00 Cairo noon)
  useEffect(() => {
    let active = true;
    setWeatherLoading(true);
    setWeatherError(null);

    fetch(`/api/weather?region=${regionId}&date=${todayIso}&hour=10`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error || `HTTP ${r.status}`);
        }
        return data as WeatherContractResponse;
      })
      .then((data) => {
        if (!active) return;
        setWeatherContract(data);
        setWeatherLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setWeatherContract(null);
        setWeatherError(err instanceof Error ? err.message : 'Weather service unavailable');
        setWeatherLoading(false);
      });

    return () => {
      active = false;
    };
  }, [regionId, todayIso]);

  const fallbackBaseline = useMemo(
    () => getDatasetAverageFormVector(regionId, todayIso, 10),
    [regionId, todayIso]
  );

  const displayFormValues: Record<FeatureKey, number> | null = useMemo(() => {
    if (weatherContract) {
      return datasetVectorToFormVector(weatherContract.features);
    }
    return null;
  }, [weatherContract]);

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

  // Lenis + GSAP Ticker + Scroll-driven video crossfading & scrubbing
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const portrait = window.matchMedia('(orientation: portrait)').matches;

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

    ['sunrise', 'dunes', 'dust'].forEach(ensureVideoLoaded);

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
      if (!v || !v.duration || Number.isNaN(v.duration)) return;
      const startFrac = ch.from || 0;
      const target = (startFrac + clamp(progress, 0, 1) * (1 - startFrac)) * v.duration;
      if (Math.abs(v.currentTime - target) > 0.03) {
        try {
          v.currentTime = target;
        } catch {
          // ignore seek race
        }
      }
    };

    const updateFrame = () => {
      const scrollY = window.scrollY;
      if (Math.abs(scrollY - lastScrollY) < 0.5 && prevActiveIdx !== -1) {
        return;
      }
      lastScrollY = scrollY;

      const vh = window.innerHeight;
      const mid = scrollY + vh * 0.5;

      let idx = 0;
      let localProg = 0;
      const weights = new Array(CHAPTERS.length).fill(0);

      CHAPTERS.forEach((ch, i) => {
        const el = sectionRefs.current[i];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const top = rect.top + scrollY;
        const h = rect.height;
        const p = clamp((mid - top) / Math.max(1, h), 0, 1);

        if (mid >= top && mid <= top + h) {
          idx = i;
          localProg = p;
        }

        const distFromMid = Math.max(0, Math.max(top - mid, mid - (top + h)));
        const blendZone = vh * 0.55;
        weights[i] = smoothStep(blendZone, 0, distFromMid);

        const contentEl = contentRefs.current[i];
        if (contentEl && !reduce) {
          const enterP = smoothStep(0.0, 0.22, p);
          const exitP = i === CHAPTERS.length - 1 ? 1 : 1 - smoothStep(0.8, 1.0, p);
          const vis = Math.min(enterP, exitP);
          const yShift = (1 - enterP) * 28 - (1 - exitP) * 22;
          contentEl.style.opacity = String(clamp(vis, 0.08, 1));
          contentEl.style.transform = `translate3d(0, ${yShift.toFixed(1)}px, 0)`;
        }
      });

      [idx - 1, idx, idx + 1, idx + 2].forEach((nearIdx) => {
        if (nearIdx >= 0 && nearIdx < CHAPTERS.length) {
          ensureVideoLoaded(CHAPTERS[nearIdx].clip);
        }
      });

      const clipWeights: Record<string, number> = {};
      const totalW = weights.reduce((a, b) => a + b, 0) || 1;
      CHAPTERS.forEach((ch, i) => {
        const normW = weights[i] / totalW;
        clipWeights[ch.clip] = (clipWeights[ch.clip] || 0) + normW;
      });

      Object.entries(videoRefs.current).forEach(([clipKey, v]) => {
        if (!v) return;
        const w = clamp(clipWeights[clipKey] || 0, 0, 1);
        v.style.opacity = w.toFixed(3);
        if (w > 0.02) {
          const ownerCh = CHAPTERS.find((c) => c.clip === clipKey);
          if (ownerCh?.mode === 'play' && !reduce) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        } else {
          v.pause();
        }
      });

      const activeCh = CHAPTERS[idx];
      if (activeCh.mode === 'scrub') {
        scrubVideo(activeCh, localProg);
      }
      if (activeCh.id === 'panel') {
        progress3dRef.current[activeCh.id] = localProg;
      }

      if (gradeRef.current) {
        if (activeCh.grade) {
          gradeRef.current.style.backgroundColor = activeCh.grade;
          gradeRef.current.style.opacity = String((activeCh.gradeOpacity || 0.28) * weights[idx]);
        } else {
          gradeRef.current.style.opacity = '0';
        }
      }

      const decimalHour = activeCh.t0 + (activeCh.t1 - activeCh.t0) * localProg;
      const nextClockStr = `${formatHhMm(decimalHour)} · ${isAr ? activeCh.nameAr : activeCh.nameEn}`;
      if (nextClockStr !== lastClockStr) {
        lastClockStr = nextClockStr;
        const clockEl = document.getElementById('clock');
        if (clockEl) {
          clockEl.textContent = nextClockStr;
        }
      }

      if (idx !== prevActiveIdx) {
        prevActiveIdx = idx;
        setActiveIdx(idx);
        setClockLabel(nextClockStr);
      }
    };

    const tickerFn = (time: number) => {
      lenis?.raf(time * 1000);
      updateFrame();
    };

    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);
    updateFrame();

    return () => {
      gsap.ticker.remove(tickerFn);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, [isAr]);

  const scrollToChapter = (chapterId: string, offsetFrac = 0.28) => {
    const idx = CHAPTERS.findIndex((c) => c.id === chapterId);
    const el = sectionRefs.current[idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const targetTop = rect.top + window.scrollY + rect.height * offsetFrac;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetTop, {
        duration: 1.5,
        easing: (t: number) => 1 - Math.pow(1 - t, 4),
      });
    } else {
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  };

  const regionInfo = SAVED_REGIONS[regionId];
  const uniqueClips = useMemo(() => Array.from(new Set(CHAPTERS.map((c) => c.clip))), []);

  return (
    <div className="relative min-h-screen bg-[#05070f] text-[#f4f5fa]">
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

      {/* Right-hand Progress Rail */}
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
          className="relative min-h-[240vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[0] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[680px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'سولار سينس · مصر' : 'SolarSense · Egypt'}
                </div>
                <h1 data-gsap-item className="cinematic-h1 mt-3 mb-4">
                  {isAr
                    ? 'حاكِ فيزياء الألواح الشمسية واختبر نموذج التنبؤ في سماء مصر.'
                    : 'Simulate solar physics and test the prediction model across Egypt.'}
                </h1>
                <p data-gsap-item className="cinematic-lede mb-6">
                  {isAr
                    ? 'أداتان هندسيتان: التوأم الرقمي ثلاثي الأبعاد بمعادلاته الفيزيائية، وصفحة اختبار نموذج التنبؤ بـ 23 متغيراً جوياً من بيانات ERA5.'
                    : 'Two focused tools: a 3D digital twin governed by explicit solar and thermal equations, and a 23-feature ERA5 weather test bench for the prediction model.'}
                </p>
                <div data-gsap-item className="flex flex-wrap items-center gap-3">
                  <Link href="/twin" className="btn-pill-primary">
                    <Box className="h-4 w-4" />
                    <span>{isAr ? 'افتح التوأم الرقمي' : 'Open the digital twin'}</span>
                  </Link>
                  <Link href="/predict" className="btn-pill">
                    <Activity className="h-4 w-4 text-[#ffd166]" />
                    <span>{isAr ? 'اختبر التنبؤ' : 'Test a prediction'}</span>
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

        {/* CHAPTER 2: EARLY MORNING DUNES */}
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
                    ? 'أكثر من إحدى عشرة ساعة يومياً. لم تكن المشكلة يوماً هل تشرق الشمس، بل معرفة كم ستحول ألواحك منها إلى طاقة في هذه الساعة وتحت هذه السماء.'
                    : 'Up to eleven hours of it a day. The hard part was never whether the sun shines. It is knowing how much of it a solar array will turn into power in a given hour under a real sky.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 3: WHY IT IS HARD */}
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
                      ? 'رياح الخماسين الربيعية تحجب جزءاً كبيراً من الإشعاع المباشر وتزيد من تشتت الضوء في الغلاف الجوي.'
                      : 'Spring Khamaseen winds strip a large share of direct sunlight on a bad day, shifting energy into diffuse haze.'}
                  </span>
                </div>
                <div data-gsap-item className="glass">
                  <b className="block font-serif text-[21px] font-semibold text-white mb-1">
                    {isAr ? 'الحرارة' : 'Heat'}
                  </b>
                  <span className="text-[14px] text-[#b9bdcf]">
                    {isAr
                      ? 'الألواح الساخنة تفقد جزءاً من قدرتها فوق 25°م. مقدار الفقد يعتمد على المعامل الحراري (γ) للوح.'
                      : 'Hot panels lose output above 25°C. How much depends on the thermal coefficient (γ) of the panel technology.'}
                  </span>
                </div>
                <div data-gsap-item className="glass">
                  <b className="block font-serif text-[21px] font-semibold text-white mb-1">
                    {isAr ? 'أربع سماوات' : 'Four skies'}
                  </b>
                  <span className="text-[14px] text-[#b9bdcf]">
                    {isAr
                      ? 'الساحل الرطب والدلتا، الصحراء الغربية، سيناء والبحر الأحمر، ووادي النيل والصعيد لكل منها سلوك جوي مختلف.'
                      : 'The humid coast, the Western Desert, Sinai and the Red Sea, and the Nile Valley all behave differently.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 4: 3D PANEL SHOWCASE (NO PRICE OR SIZING COPY) */}
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
                {isAr ? 'منتصف الصباح · فيزياء الخلايا' : 'Mid-morning · cell physics'}
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
                              {isAr ? `مناسب لـ ${regionInfo.code}` : `Suited for ${regionInfo.code}`}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-white/[0.16] pt-2.5 text-[13px] sm:grid-cols-[1fr_auto_1fr_auto]">
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'الكفاءة القياسية' : 'STC efficiency'}
                          </span>
                          <span className="text-right font-semibold text-white">
                            {item.efficiencyRange}
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'المعامل الحراري (γ)' : 'Temp. coeff. (γ)'}
                          </span>
                          <span className="text-right font-semibold text-[#ffd166]">
                            {item.tempCoeffRange}
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'حرارة التشغيل الاسمية' : 'NOCT cell temp'}
                          </span>
                          <span className="text-right font-semibold text-white">
                            {item.noctC} °C
                          </span>
                          <span className="text-[#b9bdcf]">
                            {isAr ? 'القدرة الاسمية للوح' : 'Reference module'}
                          </span>
                          <span className="text-right font-semibold text-white">
                            {item.panelWp} Wp ({item.panelAreaM2} m²)
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
                    ? 'تُستخدم هذه المعاملات الفيزيائية في التوأم الرقمي وفي المرجع الفيزيائي لصفحة التنبؤ.'
                    : 'These physical parameters feed the 3D digital twin and the physics reference on the prediction test page.'}
                </span>
                <Link href={`/twin?tech=${tech}&region=${regionId}`} className="text-[#ffd166] hover:underline">
                  {isAr ? 'محاكاة هذا اللوح في التوأم الرقمي ←' : 'Simulate this technology in the Digital Twin →'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 5: WHERE ARE YOU? (SAVED REGIONS & GLOBE PICKER -> /predict?mode=map) */}
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
              <div className="max-w-[680px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'الضحى · الأقاليم المناخية المحفوظة' : 'Late morning · saved climate regions'}
                </div>
                <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3.5">
                  {isAr
                    ? 'كل سماء في مصر مختلفة. اختبر موقعك على الخريطة.'
                    : 'Every sky in Egypt is different. Pick a region to test.'}
                </h2>
                <p data-gsap-item className="cinematic-lede mb-5">
                  {isAr
                    ? 'يعتمد نموذج التنبؤ على المناطق المحفوظة التي تدرب عليها. اختر منطقة هنا أو افتح خريطة الاختبار لجلب بيانات الطقس.'
                    : 'The prediction model operates on saved training regions. Select a region below or open the map test bench to fetch weather for a specific date and hour.'}
                </p>

                <div data-gsap-item className="mb-4 flex flex-wrap gap-2">
                  {SAVED_REGION_LIST.map((r) => {
                    const active = r.id === regionId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegionId(r.id)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'border-[#ffd166] bg-[#ffd166]/20 text-white'
                            : 'border-white/20 bg-white/[0.05] text-[#b9bdcf] hover:text-white'
                        }`}
                      >
                        {isAr ? r.nameAr : r.nameEn}
                      </button>
                    );
                  })}
                </div>

                <div data-gsap-item className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/predict?mode=map&region=${regionId}&tech=${tech}`}
                    className="btn-pill-primary"
                  >
                    <Globe2 className="h-4 w-4" />
                    <span>
                      {isAr
                        ? 'افتح اختبار الخريطة والطقس (/predict)'
                        : 'Open Map + Weather test (/predict)'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobeAutoLocate(false);
                      setGlobeOpen(true);
                    }}
                    className="btn-pill"
                  >
                    <span>{isAr ? 'معاينة الكرة الأرضية 3D' : 'Preview 3D Globe Picker'}</span>
                  </button>
                </div>

                <div data-gsap-item className="mt-3 text-[12px] text-[#b9bdcf]">
                  {isAr
                    ? `النقطة المرجعية المرسلة لخدمة الطقس: ${regionInfo.representativePoint.labelAr}. حدود الأقاليم مبدئية.`
                    : `Representative point sent to weather service: ${regionInfo.representativePoint.labelEn}. Region borders are provisional.`}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 6: NOON ("WHAT THE MODEL SEES" — 23 MODEL INPUTS GROUPED BY KIND) */}
        <section
          id="noon"
          ref={(el) => {
            sectionRefs.current[5] = el;
          }}
          className="relative min-h-[195vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[7vh] pt-20">
            <div
              ref={(el) => {
                contentRefs.current[5] = el;
              }}
              className="mx-auto w-full max-w-[1120px] will-change-[opacity,transform]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div data-gsap-item className="eyebrow">
                    {isAr
                      ? `الظهيرة · ${regionInfo.nameAr} (10:00 UTC)`
                      : `Noon · ${regionInfo.nameEn} (10:00 UTC)`}
                  </div>
                  <h2 data-gsap-item className="cinematic-h2 mt-2 mb-2">
                    {isAr
                      ? 'هذا ما يراه نموذج التنبؤ: 23 متغيراً من ERA5.'
                      : 'This is what the model sees: 23 ERA5 weather inputs.'}
                  </h2>
                </div>
                <div data-gsap-item className="flex flex-wrap items-center gap-2">
                  <span className="tag-pill live">
                    {weatherLoading
                      ? isAr
                        ? 'جاري جلب الطقس...'
                        : 'Fetching weather...'
                      : weatherContract
                        ? isAr
                          ? weatherContract.endpointLabelAr
                          : weatherContract.endpointLabelEn
                        : isAr
                          ? 'فشل الاتصال بالطقس'
                          : 'Weather API offline'}
                  </span>
                  <Link
                    href={`/predict?region=${regionId}&tech=${tech}`}
                    className="btn-pill py-1.5 px-3.5 text-xs"
                  >
                    <span>
                      {isAr ? 'تعديل المدخلات وتشغيل التنبؤ ←' : 'Edit inputs & run prediction →'}
                    </span>
                  </Link>
                </div>
              </div>

              {weatherError && (
                <div className="glass mb-3 border border-[#ff453a]/50 py-2.5 px-4 text-xs text-[#ffd166]">
                  {isAr
                    ? `تعذر جلب الطقس الحي (${weatherError}). تُعرض بالأسفل متوسطات البيانات المرجعية للمنطقة.`
                    : `Live weather request failed (${weatherError}). Showing regional dataset averages below.`}
                </div>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {FEATURE_GROUPS.map((grp) => {
                  const groupFeatures = FEATURES_23.filter((f) => f.group === grp.id);
                  return (
                    <div key={grp.id} data-gsap-item className="glass p-3.5">
                      <div className="mb-2 border-b border-white/[0.12] pb-1.5">
                        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#ffd166]">
                          {isAr ? grp.titleAr : grp.titleEn}
                        </div>
                      </div>
                      <div className="grid gap-1.5 text-[12px]">
                        {groupFeatures.map((f) => {
                          const val = displayFormValues
                            ? displayFormValues[f.key]
                            : fallbackBaseline.form[f.key];
                          const prov: FeatureProvenance = weatherContract
                            ? weatherContract.provenance[f.key]
                            : fallbackBaseline.provenance[f.key];
                          return (
                            <div
                              key={f.key}
                              className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1 last:border-none last:pb-0"
                            >
                              <div className="min-w-0 truncate">
                                <span className="font-mono text-[11px] text-[#9fe9e9]">
                                  {f.key}
                                </span>{' '}
                                <span className="text-[#b9bdcf]">
                                  {isAr ? f.labelAr : f.labelEn}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className="font-mono font-semibold text-white">
                                  {val} {f.formUnit}
                                </span>
                                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-[#b9bdcf]">
                                  {provenanceBadgeLabel(prov, isAr)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 text-xs text-[#b9bdcf]">
                {isAr
                  ? '16 متغيراً من خدمة Open-Meteo، متغير واحد محسوب فيزيائياً (ssrdc)، و6 متغيرات بمتوسطات بيانات التدريب لعدم توفر مصدر حي لها.'
                  : '16 variables supplied by Open-Meteo, 1 computed from clear-sky physics (ssrdc), and 6 filled from dataset averages where no live feed exists.'}
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 7: DUSK SUNSET */}
        <section
          id="dusk"
          ref={(el) => {
            sectionRefs.current[6] = el;
          }}
          className="relative min-h-[240vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[6] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div className="max-w-[640px]">
                <div data-gsap-item className="eyebrow">
                  {isAr ? 'الغسق' : 'Dusk'}
                </div>
                <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-3.5">
                  {isAr
                    ? 'من زاوية الشمس إلى حرارة الخلية وقدرة التيار المتردد.'
                    : 'From solar elevation to cell temperature and AC power.'}
                </h2>
                <p data-gsap-item className="cinematic-lede mb-5">
                  {isAr
                    ? 'كل رقم في المنصة يحمل مصدره بوضوح: سواء جاء من خدمة الطقس، أو معادلة فيزيائية، أو متوسط بيانات التدريب، أو نموذج التعلم الآلي.'
                    : 'Every number on screen carries its provenance badge—whether supplied by the weather API, computed from solar geometry, defaulted from dataset means, or predicted by the model.'}
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

        {/* CHAPTER 8: NIGHT — TWO FOCUSED TOOLS */}
        <section
          id="night"
          ref={(el) => {
            sectionRefs.current[7] = el;
          }}
          className="relative min-h-[240vh]"
        >
          <div className="sticky top-0 flex min-h-screen items-end px-6 pb-[9vh] pt-24">
            <div
              ref={(el) => {
                contentRefs.current[7] = el;
              }}
              className="mx-auto w-full max-w-[1040px] will-change-[opacity,transform]"
            >
              <div data-gsap-item className="eyebrow">
                {isAr ? 'بعد الغروب · ابدأ التجربة' : 'After dark · explore the two tools'}
              </div>
              <h2 data-gsap-item className="cinematic-h2 mt-2.5 mb-4">
                {isAr
                  ? 'اختر أداة للبدء'
                  : 'Choose a tool to begin'}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div data-gsap-item className="glass flex flex-col justify-between p-5">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#3fc1c1]">
                      {isAr ? 'الأداة 01 · المحاكاة الفيزيائية' : 'Tool 01 · Physics Simulation'}
                    </div>
                    <h3 className="mt-1.5 font-serif text-[26px] text-white">
                      {isAr ? 'التوأم الرقمي ثلاثي الأبعاد' : '3D Digital Twin Simulation'}
                    </h3>
                    <p className="mt-2 text-[14px] text-[#b9bdcf]">
                      {isAr
                        ? 'استعرض المصفوفة الشمسية والإنفرتر والبطارية والشبكة في مشهد ثلاثي الأبعاد تفاعلي مع المعادلات الفيزيائية الحاكمة لكل مكون.'
                        : 'Inspect the PV array, hybrid inverter, LiFePO4 rack, facility load, and grid transformer in 3D with typeset governing equations.'}
                    </p>
                  </div>
                  <div className="mt-5">
                    <Link
                      href={`/twin?region=${regionId}&tech=${tech}`}
                      className="btn-pill-primary inline-flex"
                    >
                      <Box className="h-4 w-4" />
                      <span>{isAr ? 'افتح التوأم الرقمي' : 'Open the digital twin'}</span>
                    </Link>
                  </div>
                </div>

                <div data-gsap-item className="glass flex flex-col justify-between p-5">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.1em] text-[#ffd166]">
                      {isAr ? 'الأداة 02 · اختبار النموذج' : 'Tool 02 · Model Test Bench'}
                    </div>
                    <h3 className="mt-1.5 font-serif text-[26px] text-white">
                      {isAr ? 'صفحة اختبار التنبؤ (23 متغيراً)' : 'Prediction Test Page (23 Features)'}
                    </h3>
                    <p className="mt-2 text-[14px] text-[#b9bdcf]">
                      {isAr
                        ? 'أدخل متغيرات الطقس الـ 23 يدوياً أو اختر موقعاً وتاريخاً وساعة لجلبها من خدمة الطقس، ثم قارن التنبؤ بالمرجع الفيزيائي.'
                        : 'Enter the 23 ERA5 weather features manually or pick a region, date, and UTC hour from the map and weather API, then inspect the full JSON request and response.'}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Link
                      href={`/predict?mode=manual&region=${regionId}&tech=${tech}`}
                      className="btn-pill-primary inline-flex"
                    >
                      <Activity className="h-4 w-4" />
                      <span>{isAr ? 'إدخال يدوي' : 'Manual entry'}</span>
                    </Link>
                    <Link
                      href={`/predict?mode=map&region=${regionId}&tech=${tech}`}
                      className="btn-pill inline-flex"
                    >
                      <Globe2 className="h-4 w-4 text-[#3fc1c1]" />
                      <span>{isAr ? 'الخريطة + الطقس' : 'Map + weather'}</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div data-gsap-item className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollToChapter('dawn')}
                  className="btn-pill"
                >
                  <span>{isAr ? 'العودة إلى الفجر ↑' : 'Back to dawn ↑'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 3D Satellite Globe Location Modal -> Repointed to open /predict?mode=map */}
      <GlobeLocationModal
        open={globeOpen}
        autoLocate={globeAutoLocate}
        initialLat={regionInfo.representativePoint.lat}
        initialLon={regionInfo.representativePoint.lon}
        isAr={isAr}
        onClose={() => setGlobeOpen(false)}
        onSelectLocation={(newSite) => {
          setRegionId(newSite.region);
          setGlobeOpen(false);
          router.push(`/predict?mode=map&region=${newSite.region}&tech=${tech}`);
        }}
      />
    </div>
  );
}
