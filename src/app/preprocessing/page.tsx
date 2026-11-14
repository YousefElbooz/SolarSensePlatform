'use client';

import React, { useEffect, useState } from 'react';
import { Navbar, useLanguage } from '@/components/Navbar';
import { CountUp } from '@/components/preprocessing/charts';
import { DatasetTab, PipelineTab } from '@/components/preprocessing/pipeline';
import { CorrelationTab, DailyCycleTab, DistributionsTab, MapsTab, ProfilesTab, TimeSeriesTab } from '@/components/preprocessing/plots';
import type { PPData } from '@/components/preprocessing/types';

const TABS = [
  { id: 'pipeline', en: 'Pipeline', ar: 'خط المعالجة' },
  { id: 'dataset', en: 'Rows and columns', ar: 'الصفوف والأعمدة' },
  { id: 'maps', en: 'Maps', ar: 'الخرائط' },
  { id: 'timeseries', en: 'Time series', ar: 'السلاسل الزمنية' },
  { id: 'daily', en: 'Daily cycle', ar: 'الدورة اليومية' },
  { id: 'profiles', en: 'Profiles', ar: 'المقاطع' },
  { id: 'distributions', en: 'Distributions', ar: 'التوزيعات' },
  { id: 'correlation', en: 'Correlation', ar: 'الارتباط' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function PreprocessingPage() {
  const { isAr } = useLanguage();
  const [data, setData] = useState<PPData | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabId>('pipeline');

  useEffect(() => {
    document.title = 'Preprocessing · SolarSense Egypt';
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && TABS.some((t) => t.id === q)) setTab(q as TabId);
    fetch('/data/preprocessing.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const pick = (id: TabId) => {
    setTab(id);
    window.history.replaceState(null, '', `?tab=${id}`);
  };

  return (
    <div className="cinematic-page pp-page pb-28 pt-6">
      <Navbar />
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6">
        <header className="mb-5">
          <span className="eyebrow">{isAr ? 'معالجة بيانات ERA5' : 'ERA5 data preprocessing'}</span>
          <h1 className="mt-2 text-[clamp(26px,3.4vw,40px)] font-semibold leading-[1.1] text-white">
            {isAr ? 'من ملفات الطقس الخام إلى جدول جاهز للنموذج' : 'From raw weather files to a model-ready table'}
          </h1>
          <p className="mt-2 max-w-[820px] text-[14.5px] leading-relaxed text-[#b9bdcf]">
            Every number on this page is computed from the project&apos;s own ERA5 archive by the preprocessing script. The tabs walk through what the script does, what each row and column of the
            resulting table means, and what the data shows about sunlight, heat, wind and terrain over Egypt.
          </p>
          {data && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Files merged', data.report.load.files],
                ['Days covered', data.report.time.days],
                ['Grid cells', data.report.load.cells],
                ['Daylight hours kept', data.report.features.steps],
                ['Rows in the table', data.report.features.rows],
                ['Variables checked', data.quality.length],
              ].map(([label, value], i) => (
                <div key={label as string} className="pp-panel pp-rise !p-3" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="pp-num text-[19px] font-semibold leading-tight text-white">
                    <CountUp value={value as number} />
                  </div>
                  <div className="pp-hud mt-1 !text-[9.5px] !text-[#8e93a8]">{label}</div>
                </div>
              ))}
            </div>
          )}
        </header>

        <nav aria-label="Preprocessing sections" className="no-scrollbar sticky top-[60px] z-20 -mx-4 mb-4 flex gap-1.5 overflow-x-auto bg-[rgba(6,8,16,0.86)] px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
          {TABS.map((t, i) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)} className={`pp-tab ${tab === t.id ? 'active' : ''}`}>
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </nav>

        {error && (
          <div className="pp-panel text-[14px] text-[#ff9db0]">
            The preprocessing data file could not be loaded. Run <code className="pp-num">scripts/preprocessing/export_web.py</code> to create <code className="pp-num">public/data/preprocessing.json</code>.
          </div>
        )}
        {!data && !error && (
          <div className="pp-panel flex items-center gap-3 text-[13px] text-[#b9bdcf]">
            <span className="globe-spin" /> Loading the preprocessing results…
          </div>
        )}
        {data && (
          <div key={tab} dir="ltr">
            {tab === 'pipeline' && <PipelineTab d={data} />}
            {tab === 'dataset' && <DatasetTab d={data} />}
            {tab === 'maps' && <MapsTab d={data} />}
            {tab === 'timeseries' && <TimeSeriesTab d={data} />}
            {tab === 'daily' && <DailyCycleTab d={data} />}
            {tab === 'profiles' && <ProfilesTab d={data} />}
            {tab === 'distributions' && <DistributionsTab d={data} />}
            {tab === 'correlation' && <CorrelationTab d={data} />}
            <p className="pp-num mt-6 text-[11px] text-[#6c7288]">
              Source: ERA5 hourly data on single levels (Copernicus Climate Data Store) · exported {data.generated} · {data.report.time.start.slice(0, 10)} to {data.report.time.end.slice(0, 10)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
