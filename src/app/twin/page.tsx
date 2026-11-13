'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { Navbar, useLanguage } from '@/components/Navbar';
import { ANCHOR_CITIES, snapToGridCell } from '@/domain/regions';
import { normalizePanelTech, PANEL_TECHNOLOGIES, PANEL_TECH_LIST } from '@/domain/panels';
import {
  computeSolarPosition,
  getDayOfYear,
  simulateIrradianceAndPoa,
  simulatePvPowerStep,
} from '@/domain/physics';
import { PanelTech, SeasonId, SkyCondition } from '@/domain/types';
import { Play, Pause, Thermometer, Zap } from 'lucide-react';

function DigitalTwinContent() {
  const searchParams = useSearchParams();
  const { isAr } = useLanguage();

  const [tech, setTech] = useState<PanelTech>(() =>
    normalizePanelTech(searchParams.get('tech') || 'a-Si:H/sc-Si')
  );
  const [panelCount, setPanelCount] = useState<number>(() => {
    const c = Number(searchParams.get('count') ?? 24);
    return Number.isNaN(c) ? 24 : Math.max(6, Math.min(60, c));
  });
  const [cityId, setCityId] = useState<string>('aswan-benban');
  const [hourLocal, setHourLocal] = useState<number>(12.5);
  const [season, setSeason] = useState<SeasonId>('summer');
  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');
  const [heatmapMode, setHeatmapMode] = useState<'power' | 'temperature'>('power');
  const [playingDay, setPlayingDay] = useState<boolean>(false);

  const city = useMemo(
    () => ANCHOR_CITIES.find((c) => c.id === cityId) || ANCHOR_CITIES[0],
    [cityId]
  );
  const site = useMemo(() => snapToGridCell(city.lat, city.lon), [city]);
  const spec = PANEL_TECHNOLOGIES[tech];
  const systemKwp = Math.round(panelCount * (spec.panelWp / 1000) * 100) / 100;
  const tiltDeg = Math.round(site.cellLat * 0.9);

  const telemetry = useMemo(() => {
    const doy = getDayOfYear(season);
    const solar = computeSolarPosition(site.cellLat, site.cellLon, hourLocal, doy);
    const irr = simulateIrradianceAndPoa({
      solar,
      tiltDeg,
      panelAzimuthDeg: 180,
      skyCondition,
    });

    const baseTemp =
      season === 'summer'
        ? 41
        : season === 'spring'
          ? 34
          : season === 'autumn'
            ? 30
            : 21;
    const heatwaveBonus = skyCondition === 'heatwave' ? 6 : 0;
    const diurnal = Math.sin(Math.max(0, ((hourLocal - 5.5) / 14) * Math.PI));
    const tAmbC = Math.round((baseTemp - 10 + diurnal * 11 + heatwaveBonus) * 10) / 10;

    const pv = simulatePvPowerStep({
      tech,
      kWp: systemKwp,
      poaWm2: irr.poaWm2,
      poaClearWm2: irr.poaClearWm2,
      tAmbC,
      windSpeedMs: 3.8,
      skyCondition,
    });

    const houseLoadKw = Math.round(Math.max(1.2, systemKwp * 0.28) * 100) / 100;
    const surplusKw = Math.max(0, pv.pAcKw - houseLoadKw);
    const batteryChargeKw = Math.round(Math.min(systemKwp * 0.35, surplusKw * 0.65) * 100) / 100;
    const gridExportKw = Math.round(Math.max(0, surplusKw - batteryChargeKw) * 100) / 100;
    const batterySocPct = Math.min(
      98,
      Math.max(20, Math.round(25 + ((hourLocal - 6) / 13) * 70))
    );

    return {
      solar,
      irr,
      tAmbC,
      pv,
      houseLoadKw,
      batteryChargeKw,
      gridExportKw,
      batterySocPct,
    };
  }, [site, season, hourLocal, tiltDeg, skyCondition, tech, systemKwp]);

  useEffect(() => {
    if (!playingDay) return;
    const id = setInterval(() => {
      setHourLocal((prev) => {
        if (prev >= 19.5) return 5.0;
        return Math.round((prev + 0.15) * 100) / 100;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playingDay]);

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const twinStateRef = useRef({
    telemetry,
    panelCount,
    heatmapMode,
    tiltDeg,
  });
  twinStateRef.current = { telemetry, panelCount, heatmapMode, tiltDeg };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x785c38, 0.45);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff3d1, 2.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunLight.shadow.camera, {
      left: -14,
      right: 14,
      top: 14,
      bottom: -14,
      near: 1,
      far: 60,
    });
    scene.add(sunLight, sunLight.target);

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    scene.add(sunOrb);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0xb5a68f, roughness: 0.92 })
    );
    ground.position.set(0, -0.2, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const hubMat = (color: number) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
    const inverterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), hubMat(0xf5a524));
    inverterMesh.position.set(-6.5, 0.55, -4.5);
    inverterMesh.castShadow = true;

    const batteryMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 0.8), hubMat(0x3fc1c1));
    batteryMesh.position.set(-2.2, 0.65, -4.8);
    batteryMesh.castShadow = true;

    const loadMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.2), hubMat(0x60a5fa));
    loadMesh.position.set(2.4, 0.75, -4.8);
    loadMesh.castShadow = true;

    const gridMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.8), hubMat(0xa855f7));
    gridMesh.position.set(6.5, 0.9, -4.5);
    gridMesh.castShadow = true;

    scene.add(inverterMesh, batteryMesh, loadMesh, gridMesh);

    const arrayGroup = new THREE.Group();
    scene.add(arrayGroup);
    const panelGeo = new THREE.BoxGeometry(1.05, 1.7, 0.045);
    const panelMeshes: THREE.Mesh[] = [];

    const flowPaths: [THREE.Vector3, THREE.Vector3, number][] = [
      [new THREE.Vector3(0, 0.6, 1.2), new THREE.Vector3(-6.5, 0.6, -4.5), 0xffd166],
      [new THREE.Vector3(-6.5, 0.6, -4.5), new THREE.Vector3(-2.2, 0.6, -4.8), 0x3fc1c1],
      [new THREE.Vector3(-6.5, 0.6, -4.5), new THREE.Vector3(2.4, 0.6, -4.8), 0x60a5fa],
      [new THREE.Vector3(-6.5, 0.6, -4.5), new THREE.Vector3(6.5, 0.6, -4.5), 0xc084fc],
    ];

    const particleGroup = new THREE.Group();
    scene.add(particleGroup);
    const particleGeo = new THREE.SphereGeometry(0.14, 10, 10);
    const particles: { mesh: THREE.Mesh; pathIdx: number; offset: number }[] = [];

    flowPaths.forEach(([, , color], pIdx) => {
      const mat = new THREE.MeshBasicMaterial({ color });
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(particleGeo, mat);
        particleGroup.add(m);
        particles.push({ mesh: m, pathIdx: pIdx, offset: i / 6 });
      }
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let yaw = 0.35;
    let pitch = 0.58;
    let dragging = false;
    let last: [number, number] = [0, 0];

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = [e.clientX, e.clientY];
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - last[0]) * 0.007;
      pitch = Math.max(0.2, Math.min(1.3, pitch + (e.clientY - last[1]) * 0.004));
      last = [e.clientX, e.clientY];
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let lastCount = -1;
    let rafId = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const { telemetry: tel, panelCount: count, heatmapMode: mode, tiltDeg: tilt } =
        twinStateRef.current;

      if (count !== lastCount) {
        while (panelMeshes.length > 0) {
          arrayGroup.remove(panelMeshes.pop()!);
        }
        const cols = 8;
        for (let k = 0; k < count; k++) {
          const mat = new THREE.MeshStandardMaterial({
            color: 0x1e3a8a,
            roughness: 0.25,
            metalness: 0.4,
          });
          const m = new THREE.Mesh(panelGeo, mat);
          m.castShadow = true;
          m.receiveShadow = true;
          const c = k % cols;
          const r = Math.floor(k / cols);
          m.position.set((c - (cols - 1) / 2) * 1.3, 0.55, 4.2 - r * 2.1);
          m.rotation.x = -(Math.PI / 2 - THREE.MathUtils.degToRad(tilt));
          panelMeshes.push(m);
          arrayGroup.add(m);
        }
        lastCount = count;
      }

      const powerRatio = Math.min(1, tel.pv.pAcKw / Math.max(0.5, count * 0.35));
      const tempNorm = Math.min(1, Math.max(0, (tel.pv.tCellC - 20) / 48));
      panelMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mode === 'power') {
          mat.color.setHSL(0.58 - powerRatio * 0.46, 0.85, 0.22 + powerRatio * 0.34);
        } else {
          mat.color.setHSL(0.52 * (1 - tempNorm), 0.88, 0.3 + tempNorm * 0.22);
        }
      });

      const elevRad = THREE.MathUtils.degToRad(Math.max(2, tel.solar.elevationDeg));
      const azRad = THREE.MathUtils.degToRad(tel.solar.azimuthDeg);
      const sunRadius = 15;
      const sx = sunRadius * Math.cos(elevRad) * Math.sin(azRad);
      const sy = sunRadius * Math.sin(elevRad);
      const sz = -sunRadius * Math.cos(elevRad) * Math.cos(azRad);
      sunLight.position.set(sx, sy, sz);
      sunOrb.position.set(sx * 0.85, sy * 0.85, sz * 0.85);
      sunLight.intensity = tel.solar.elevationDeg > 0 ? 2.4 : 0.05;

      const speed = 0.00055 * (0.3 + powerRatio * 1.5);
      particles.forEach((p) => {
        const [start, end] = flowPaths[p.pathIdx];
        const activeLink =
          p.pathIdx === 0
            ? tel.pv.pAcKw > 0.05
            : p.pathIdx === 1
              ? tel.batteryChargeKw > 0.05
              : p.pathIdx === 2
                ? tel.pv.pAcKw > 0.05
                : tel.gridExportKw > 0.05;
        p.mesh.visible = activeLink;
        if (activeLink) {
          const t = (now * speed + p.offset) % 1;
          p.mesh.position.lerpVectors(start, end, t);
        }
      });

      const dist = 22;
      camera.position.set(
        dist * Math.sin(yaw) * Math.cos(pitch),
        dist * Math.sin(pitch),
        dist * Math.cos(yaw) * Math.cos(pitch)
      );
      camera.lookAt(0, 0.3, -0.5);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
    };
  }, []);

  const clockStr = `${String(Math.floor(hourLocal)).padStart(2, '0')}:${String(
    Math.floor((hourLocal % 1) * 60)
  ).padStart(2, '0')} · 3D Twin`;

  return (
    <div className="cinematic-page pb-16 pt-8">
      <Navbar clockLabel={clockStr} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              {isAr ? 'التوأم الرقمي التفاعلي ثلاثي الأبعاد' : 'Interactive 3D Digital Twin'}
            </div>
            <h1 className="cinematic-h2 mt-2">
              {isAr
                ? 'مسار الشمس الفلكي، الخرائط الحرارية، وتدفق الطاقة'
                : 'True astronomical sun path, cell heatmaps & live energy flows'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setHeatmapMode('power')}
              className={heatmapMode === 'power' ? 'btn-pill-primary' : 'btn-pill'}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{isAr ? 'تلوين حسب القدرة (kW)' : 'Colour by Power (kW)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setHeatmapMode('temperature')}
              className={heatmapMode === 'temperature' ? 'btn-pill-primary' : 'btn-pill'}
            >
              <Thermometer className="h-3.5 w-3.5" />
              <span>{isAr ? 'تلوين حسب حرارة الخلية (°C)' : 'Colour by Cell Temp (°C)'}</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* 3D Scene Stage + Scrubber Bar */}
          <div className="glass lg:col-span-8">
            <div
              ref={hostRef}
              className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-[#05070f]"
            >
              <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab"
                aria-label="3D Digital Twin Scene"
              />

              {/* Floating Legend */}
              <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2 font-mono text-[11px]">
                <span className="rounded-full border border-[#ffd166]/40 bg-[#05070f]/80 px-3 py-1 text-[#ffd166] backdrop-blur-md">
                  ● Panels → Inverter ({telemetry.pv.pAcKw} kW)
                </span>
                <span className="rounded-full border border-[#3fc1c1]/40 bg-[#05070f]/80 px-3 py-1 text-[#9fe9e9] backdrop-blur-md">
                  ● Inverter → Battery ({telemetry.batteryChargeKw} kW)
                </span>
                <span className="rounded-full border border-sky-400/40 bg-[#05070f]/80 px-3 py-1 text-sky-200 backdrop-blur-md">
                  ● House Loads ({telemetry.houseLoadKw} kW)
                </span>
                <span className="rounded-full border border-purple-400/40 bg-[#05070f]/80 px-3 py-1 text-purple-200 backdrop-blur-md">
                  ● Grid Export ({telemetry.gridExportKw} kW)
                </span>
              </div>
            </div>

            {/* Time Scrubber & Weather Toggles */}
            <div className="mt-4 rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPlayingDay((p) => !p)}
                  className="btn-pill-primary"
                >
                  {playingDay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>
                    {playingDay
                      ? isAr
                        ? 'إيقاف مؤقت'
                        : 'Pause Day'
                      : isAr
                        ? 'تشغيل يوم كامل (10 ثوانٍ)'
                        : 'Play Full Day in 10s'}
                  </span>
                </button>

                <div className="min-w-[200px] flex-1 px-2">
                  <div className="flex justify-between text-xs text-[#b9bdcf]">
                    <span>Local Solar Time</span>
                    <b className="font-mono text-[#ffd166]">
                      {String(Math.floor(hourLocal)).padStart(2, '0')}:
                      {String(Math.floor((hourLocal % 1) * 60)).padStart(2, '0')} · Sun Elev{' '}
                      {telemetry.solar.elevationDeg.toFixed(1)}°
                    </b>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={19.5}
                    step={0.25}
                    value={hourLocal}
                    onChange={(e) => setHourLocal(Number(e.target.value))}
                    className="mt-1.5 w-full"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-white/[0.14] pt-3 sm:grid-cols-3">
                <div>
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Site Location
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                    className="mt-1.5 w-full rounded-full border border-white/[0.16] bg-[#05070f] px-3.5 py-1.5 text-xs text-white focus:border-[#ffd166] focus:outline-none"
                  >
                    {ANCHOR_CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn} ({c.lat.toFixed(1)}°N)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Season
                  </label>
                  <div className="mt-1.5 flex gap-1">
                    {(['winter', 'spring', 'summer', 'autumn'] as SeasonId[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeason(s)}
                        className={`flex-1 rounded-full py-1.5 text-[11px] capitalize transition ${
                          season === s
                            ? 'bg-[#f5a524] font-semibold text-[#221500]'
                            : 'bg-white/[0.06] text-[#b9bdcf] hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Sky Condition
                  </label>
                  <div className="mt-1.5 flex gap-1">
                    {(['clear', 'dust', 'cloud', 'heatwave'] as SkyCondition[]).map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => setSkyCondition(sk)}
                        className={`flex-1 rounded-full py-1.5 text-[11px] capitalize transition ${
                          skyCondition === sk
                            ? 'bg-[#3fc1c1] font-semibold text-[#05070f]'
                            : 'bg-white/[0.06] text-[#b9bdcf] hover:text-white'
                        }`}
                      >
                        {sk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Telemetry & Array Config Sidebar */}
          <div className="glass flex flex-col justify-between lg:col-span-4">
            <div>
              <div className="eyebrow">Live Twin Telemetry</div>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-white">
                {systemKwp} kWp ({panelCount} × {tech})
              </h2>

              <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                <div className="flex gap-1.5">
                  {PANEL_TECH_LIST.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTech(t.key)}
                      className={`flex-1 rounded-full py-1.5 font-mono text-xs transition ${
                        tech === t.key
                          ? 'bg-[#f5a524] font-bold text-[#221500]'
                          : 'bg-white/[0.06] text-[#b9bdcf] hover:text-white'
                      }`}
                    >
                      {t.key}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[#b9bdcf]">
                    <span>Array Module Count</span>
                    <b className="font-mono text-white">{panelCount} modules</b>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={56}
                    step={2}
                    value={panelCount}
                    onChange={(e) => setPanelCount(Number(e.target.value))}
                    className="mt-1.5 w-full"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[11px] uppercase text-[#b9bdcf]">AC Power Now</div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#ffd166]">
                    {telemetry.pv.pAcKw} kW
                  </div>
                  <div className="text-[11px] text-[#b9bdcf]">
                    Clear-sky: {telemetry.pv.pClearKw} kW
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[11px] uppercase text-[#b9bdcf]">Cell Temp</div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#ffd166]">
                    {telemetry.pv.tCellC} °C
                  </div>
                  <div className="text-[11px] text-[#b9bdcf]">Ambient: {telemetry.tAmbC} °C</div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[11px] uppercase text-[#b9bdcf]">POA Irradiance</div>
                  <div className="mt-1 font-serif text-2xl font-bold text-white">
                    {Math.round(telemetry.irr.poaWm2)} W/m²
                  </div>
                  <div className="font-mono text-[11px] text-[#9fe9e9]">
                    k_c = {telemetry.irr.kc.toFixed(2)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[11px] uppercase text-[#b9bdcf]">Perf. Ratio</div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#9fe9e9]">
                    {Math.round(telemetry.pv.performanceRatio * 100)}%
                  </div>
                  <div className="text-[11px] text-[#b9bdcf]">
                    Battery SoC: {telemetry.batterySocPct}%
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5 font-mono text-[11px] text-[#b9bdcf]">
              <b className="text-white">Physics Chain:</b> Sun Elevation{' '}
              {telemetry.solar.elevationDeg.toFixed(1)}°, Azimuth{' '}
              {telemetry.solar.azimuthDeg.toFixed(0)}° → Tilted POA ({tiltDeg}°S) → Faiman Cell Temp
              → PVWatts (γ = {spec.tempCoeffPctPerC}%/°C).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DigitalTwinPage() {
  return (
    <Suspense
      fallback={
        <div className="cinematic-page p-12 text-[#b9bdcf]">Loading 3D Digital Twin...</div>
      }
    >
      <DigitalTwinContent />
    </Suspense>
  );
}
