'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PANEL_TECHNOLOGIES, techToShortKey } from '@/domain/panels';
import { PanelTech } from '@/domain/types';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

let cachedPoly: HTMLCanvasElement | null = null;
let cachedHjt: HTMLCanvasElement | null = null;
let cachedCigs: HTMLCanvasElement | null = null;
let cachedSky: HTMLCanvasElement | null = null;
let cachedConcrete: HTMLCanvasElement | null = null;

function polyTexture(): HTMLCanvasElement {
  if (cachedPoly) return cachedPoly;
  const [c, g] = makeCanvas(540, 900);
  const rnd = seeded(7);
  const cols = 6;
  const rows = 10;
  const m = 14;
  const gap = 3;
  const cw = (c.width - 2 * m - (cols - 1) * gap) / cols;
  const ch = (c.height - 2 * m - (rows - 1) * gap) / rows;
  g.fillStyle = '#c9ced6';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = m + i * (cw + gap);
      const y = m + j * (ch + gap);
      g.save();
      g.beginPath();
      g.rect(x, y, cw, ch);
      g.clip();
      g.fillStyle = '#16327a';
      g.fillRect(x, y, cw, ch);
      for (let k = 0; k < 24; k++) {
        const px = x + rnd() * cw;
        const py = y + rnd() * ch;
        const r = 6 + rnd() * 20;
        g.fillStyle = `hsla(${214 + rnd() * 20},${55 + rnd() * 25}%,${14 + rnd() * 20}%,.6)`;
        g.beginPath();
        for (let a = 0, n = 3 + Math.floor(rnd() * 3); a < n; a++) {
          const t = (a / n) * Math.PI * 2 + rnd();
          g.lineTo(
            px + Math.cos(t) * r * (0.5 + rnd()),
            py + Math.sin(t) * r * (0.5 + rnd())
          );
        }
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(205,215,235,.13)';
      g.lineWidth = 1;
      for (let fy = y + 3; fy < y + ch; fy += 6) {
        g.beginPath();
        g.moveTo(x, fy);
        g.lineTo(x + cw, fy);
        g.stroke();
      }
      g.fillStyle = '#aab2bd';
      for (let b = 1; b <= 3; b++) {
        g.fillRect(x + (cw * b) / 4 - 1.2, y, 2.4, ch);
      }
      g.restore();
    }
  }
  cachedPoly = c;
  return c;
}

function hjtTexture(): HTMLCanvasElement {
  if (cachedHjt) return cachedHjt;
  const [c, g] = makeCanvas(540, 912);
  const cols = 6;
  const rows = 10;
  const m = 14;
  const gap = 3;
  const cut = 10;
  const cw = (c.width - 2 * m - (cols - 1) * gap) / cols;
  const ch = (c.height - 2 * m - (rows - 1) * gap) / rows;
  g.fillStyle = '#15171c';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = m + i * (cw + gap);
      const y = m + j * (ch + gap);
      g.save();
      g.beginPath();
      g.moveTo(x + cut, y);
      g.lineTo(x + cw - cut, y);
      g.lineTo(x + cw, y + cut);
      g.lineTo(x + cw, y + ch - cut);
      g.lineTo(x + cw - cut, y + ch);
      g.lineTo(x + cut, y + ch);
      g.lineTo(x, y + ch - cut);
      g.lineTo(x, y + cut);
      g.closePath();
      g.clip();
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, '#0d1424');
      grad.addColorStop(1, '#05070d');
      g.fillStyle = grad;
      g.fillRect(x, y, cw, ch);
      g.strokeStyle = 'rgba(150,170,205,.07)';
      g.lineWidth = 1;
      for (let fy = y + 2; fy < y + ch; fy += 5) {
        g.beginPath();
        g.moveTo(x, fy);
        g.lineTo(x + cw, fy);
        g.stroke();
      }
      g.fillStyle = 'rgba(185,198,220,.50)';
      for (let b = 1; b <= 9; b++) {
        g.fillRect(x + (cw * b) / 10 - 0.6, y, 1.2, ch);
      }
      g.restore();
    }
  }
  cachedHjt = c;
  return c;
}

function cigsTexture(): HTMLCanvasElement {
  if (cachedCigs) return cachedCigs;
  const [c, g] = makeCanvas(540, 700);
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#0e1014');
  grad.addColorStop(0.5, '#08090c');
  grad.addColorStop(1, '#101216');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,.055)';
  for (let x = 10; x < c.width - 10; x += 5) {
    g.fillRect(x, 10, 1, c.height - 20);
  }
  g.strokeStyle = 'rgba(160,170,190,.30)';
  g.lineWidth = 2;
  g.strokeRect(8, 8, c.width - 16, c.height - 16);
  cachedCigs = c;
  return c;
}

function skyTexture(): HTMLCanvasElement {
  if (cachedSky) return cachedSky;
  const [c, g] = makeCanvas(512, 256);
  const sky = g.createLinearGradient(0, 0, 0, c.height);
  sky.addColorStop(0, '#2b6cb8');
  sky.addColorStop(0.46, '#cfe2f1');
  sky.addColorStop(0.52, '#d8c39a');
  sky.addColorStop(1, '#6d5433');
  g.fillStyle = sky;
  g.fillRect(0, 0, c.width, c.height);
  const sun = g.createRadialGradient(165, 65, 0, 165, 65, 45);
  sun.addColorStop(0, 'rgba(255,255,255,1)');
  sun.addColorStop(0.25, 'rgba(255,244,214,.9)');
  sun.addColorStop(1, 'rgba(255,230,170,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, c.width, c.height);
  cachedSky = c;
  return c;
}

function concreteTexture(): HTMLCanvasElement {
  if (cachedConcrete) return cachedConcrete;
  const [c, g] = makeCanvas(256, 256);
  const rnd = seeded(31);
  g.fillStyle = '#b9ad9a';
  g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 1400; k++) {
    const v = 150 + rnd() * 70;
    g.fillStyle = `rgba(${v},${v - 8},${v - 22},${0.1 + rnd() * 0.16})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let k = 0; k < 10; k++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 15 + rnd() * 40;
    const st = g.createRadialGradient(x, y, 0, x, y, r);
    st.addColorStop(0, `rgba(${rnd() < 0.5 ? '96,84,68' : '214,205,190'},.16)`);
    st.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = st;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.strokeStyle = 'rgba(80,70,58,.20)';
  g.lineWidth = 1;
  for (let q = 0; q <= 256; q += 128) {
    g.beginPath();
    g.moveTo(q, 0);
    g.lineTo(q, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, q);
    g.lineTo(256, q);
    g.stroke();
  }
  cachedConcrete = c;
  return c;
}

const SPECS = {
  pc: {
    w: 0.99,
    h: 1.65,
    tex: polyTexture,
    frame: 0xc9cdd3,
    frameRough: 0.32,
    back: 0xe9ecef,
    rail: 0.035,
  },
  hjt: {
    w: 1.0,
    h: 1.69,
    tex: hjtTexture,
    frame: 0x1a1b1f,
    frameRough: 0.42,
    back: 0x0d0e11,
    rail: 0.035,
  },
  cigs: {
    w: 0.98,
    h: 1.26,
    tex: cigsTexture,
    frame: 0x151619,
    frameRough: 0.48,
    back: 0x0d0e11,
    rail: 0.018,
  },
} as const;

function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const sky = new THREE.CanvasTexture(skyTexture());
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(sky).texture;
  sky.dispose();
  pmrem.dispose();
  return env;
}

function buildModuleGroup(
  shortKey: 'pc' | 'hjt' | 'cigs',
  renderer: THREE.WebGLRenderer
): THREE.Group {
  const spec = SPECS[shortKey];
  const group = new THREE.Group();
  const depth = 0.04;
  const t = spec.rail;
  const map = new THREE.CanvasTexture(spec.tex());
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w - 2 * t * 0.6, spec.h - 2 * t * 0.6, 0.006),
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.82,
    })
  );
  glass.position.z = depth / 2 - 0.004;

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w - 2 * t, spec.h - 2 * t, 0.004),
    new THREE.MeshStandardMaterial({ color: spec.back, roughness: 0.8 })
  );
  back.position.z = depth / 2 - 0.012;

  const frameMat = new THREE.MeshStandardMaterial({
    color: spec.frame,
    metalness: 0.9,
    roughness: spec.frameRough,
  });
  const railsCoords: [number, number, number, number][] = [
    [spec.w, t, 0, spec.h / 2 - t / 2],
    [spec.w, t, 0, -spec.h / 2 + t / 2],
    [t, spec.h - 2 * t, -spec.w / 2 + t / 2, 0],
    [t, spec.h - 2 * t, spec.w / 2 - t / 2, 0],
  ];
  const rails = railsCoords.map(([w, h, x, y]) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), frameMat);
    r.position.set(x, y, 0);
    return r;
  });

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.1, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6 })
  );
  box.position.set(0, spec.h * 0.33, depth / 2 - 0.026);
  group.add(glass, back, box, ...rails);
  return group;
}

export function PanelThreeViewer({
  tech,
  isAr = false,
  heightClass = 'h-[min(56vh,480px)]',
  getProgress,
}: {
  tech: PanelTech;
  isAr?: boolean;
  heightClass?: string;
  getProgress?: () => number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setTechRef = useRef<((k: 'pc' | 'hjt' | 'cigs') => void) | null>(null);
  const getProgressRef = useRef(getProgress);
  getProgressRef.current = getProgress;

  const info = PANEL_TECHNOLOGIES[tech];
  const callouts = isAr ? info.calloutsAr : info.calloutsEn;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.03, 4.0);
    scene.environment = buildEnvironment(renderer);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    sun.position.set(-2.5, 3, 4);
    scene.add(sun);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const modules: Record<'pc' | 'hjt' | 'cigs', THREE.Group> = {
      pc: buildModuleGroup('pc', renderer),
      hjt: buildModuleGroup('hjt', renderer),
      cigs: buildModuleGroup('cigs', renderer),
    };
    Object.values(modules).forEach((m) => {
      m.visible = false;
      pivot.add(m);
    });

    let curKey: 'pc' | 'hjt' | 'cigs' = techToShortKey(tech);
    modules[curKey].visible = true;

    let yaw = -0.5;
    let pitch = -0.22;
    let swap: { to: 'pc' | 'hjt' | 'cigs'; t0: number; done: boolean } | null = null;
    let visible = true;
    let dragging = false;
    let last: [number, number] = [0, 0];
    let idleFrom = performance.now();

    setTechRef.current = (nextKey) => {
      if (nextKey === curKey) return;
      swap = { to: nextKey, t0: performance.now(), done: false };
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 0.75 ? 4.9 : 4.0;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const io = new IntersectionObserver(
      (es) => {
        visible = es[0].isIntersecting;
      },
      { rootMargin: '200px' }
    );
    io.observe(host);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = [e.clientX, e.clientY];
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - last[0]) * 0.008;
      pitch = Math.max(-0.7, Math.min(0.35, pitch + (e.clientY - last[1]) * 0.004));
      last = [e.clientX, e.clientY];
    };
    const onUp = () => {
      dragging = false;
      idleFrom = performance.now();
      canvas.style.cursor = 'grab';
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') yaw -= 0.15;
      else if (e.key === 'ArrowRight') yaw += 0.15;
      else return;
      e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    const anchorPoints = [
      new THREE.Vector3(-0.36, 0.52, 0.03),
      new THREE.Vector3(0.38, -0.05, 0.03),
      new THREE.Vector3(-0.38, -0.58, 0.03),
    ];
    const tmpV = new THREE.Vector3();

    let rafId = 0;
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (!visible) return;
      let spin = 0;
      if (swap) {
        const p = Math.min(1, (now - swap.t0) / 750);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        spin = eased * Math.PI * 2;
        if (p >= 0.5 && !swap.done) {
          modules[curKey].visible = false;
          curKey = swap.to;
          modules[curKey].visible = true;
          swap.done = true;
        }
        if (p >= 1) swap = null;
      }
      const sway = dragging ? 0 : Math.sin((now - idleFrom) / 2600) * 0.16;
      const prog = getProgressRef.current ? getProgressRef.current() : 0.5;
      const travel = (prog - 0.5) * 1.5;
      pivot.rotation.set(pitch, yaw + sway + spin + travel, 0);
      renderer.render(scene, camera);

      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w && h) {
        anchorPoints.forEach((pt, idx) => {
          const el = calloutRefs.current[idx];
          if (!el) return;
          tmpV.copy(pt).applyEuler(pivot.rotation).project(camera);
          const x = (tmpV.x * 0.5 + 0.5) * w;
          const y = (-tmpV.y * 0.5 + 0.5) * h;
          el.style.left = `${x.toFixed(1)}px`;
          el.style.top = `${y.toFixed(1)}px`;
          el.style.opacity = swap ? '0' : '0.92';
        });
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    setTechRef.current?.(techToShortKey(tech));
  }, [tech]);

  return (
    <div ref={hostRef} className={`relative w-full select-none ${heightClass}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        className="h-full w-full cursor-grab touch-pan-y block focus-visible:outline-2 focus-visible:outline-[#ffd166]"
        aria-label="3D model of the selected solar panel. Drag or use the arrow keys to turn it."
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {callouts.map((text, idx) => (
          <div
            key={idx}
            ref={(el) => {
              calloutRefs.current[idx] = el;
            }}
            className="
              absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap
              rounded-full border border-[#ffd166]/45 bg-[#05070f]/80 px-2.5 py-0.5
              text-[11px] text-[#f4f5fa] backdrop-blur-md transition-opacity duration-200
            "
          >
            {text}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
        {isAr ? 'اسحب لتدوير اللوح' : 'Drag to turn the panel'}
      </div>
    </div>
  );
}

export function RooftopThreeViewer({
  tech,
  panelCount,
  areaM2,
  tiltDeg = 26,
  isAr = false,
  heightClass = 'h-[min(56vh,480px)]',
  getProgress,
}: {
  tech: PanelTech;
  panelCount: number;
  areaM2: number;
  tiltDeg?: number;
  isAr?: boolean;
  heightClass?: string;
  getProgress?: () => number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roofCalloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const getProgressRef = useRef(getProgress);
  getProgressRef.current = getProgress;

  const updateRef = useRef<
    ((next: { tech: 'pc' | 'hjt' | 'cigs'; count: number; area: number; tiltDeg: number }) => void) | null
  >(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.environment = buildEnvironment(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

    const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target, new THREE.HemisphereLight(0xcfe2ff, 0x8a7350, 0.35));

    const concrete = new THREE.CanvasTexture(concreteTexture());
    concrete.colorSpace = THREE.SRGBColorSpace;
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;

    const mats = {
      floor: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xcbb994, roughness: 0.92 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xd9cbab, roughness: 0.9 }),
      tank: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3a2f25, roughness: 0.8 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8d9299, metalness: 0.8, roughness: 0.45 }),
    };

    const panelKit: Record<
      'pc' | 'hjt' | 'cigs',
      { geo: THREE.BoxGeometry; mats: THREE.Material[]; spec: (typeof SPECS)['pc'] }
    > = {} as never;
    (['pc', 'hjt', 'cigs'] as const).forEach((k) => {
      const spec = SPECS[k];
      const map = new THREE.CanvasTexture(spec.tex());
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const glass = new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.75,
      });
      const frame = new THREE.MeshStandardMaterial({
        color: spec.frame,
        metalness: 0.85,
        roughness: spec.frameRough,
      });
      const back = new THREE.MeshStandardMaterial({ color: spec.back, roughness: 0.8 });
      panelKit[k] = {
        geo: new THREE.BoxGeometry(spec.w, spec.h, 0.04),
        mats: [frame, frame, frame, frame, glass, back],
        spec: spec as (typeof SPECS)['pc'],
      };
    });

    const building = new THREE.Group();
    const array = new THREE.Group();
    scene.add(building, array);

    const addBox = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      building.add(m);
      return m;
    };

    const NORTH_STRIP = 2.4;
    let cur = { tech: '' as string, count: -1, area: -1, tiltDeg: 26 };
    let dist = 20;
    let wantDist = 20;
    const target = new THREE.Vector3();
    const panels: THREE.Mesh[] = [];

    const buildRoof = (W: number, D: number) => {
      for (const m of [...building.children]) {
        building.remove(m);
        if ((m as THREE.Mesh).geometry) (m as THREE.Mesh).geometry.dispose();
      }
      const fullD = D + NORTH_STRIP;
      const zc = -NORTH_STRIP / 2;
      const ow = W + 0.7;
      const od = fullD + 0.7;
      concrete.repeat.set(ow / 3, od / 3);
      addBox(ow, 0.3, od, mats.floor, 0, -0.15, zc);
      addBox(ow, 1.5, od, mats.plaster, 0, -1.05, zc).castShadow = false;
      const walls: [number, number, number, number][] = [
        [ow, 0.16, 0, zc + od / 2 - 0.08],
        [ow, 0.16, 0, zc - od / 2 + 0.08],
        [0.16, od, -ow / 2 + 0.08, zc],
        [0.16, od, ow / 2 - 0.08, zc],
      ];
      walls.forEach(([w, d, x, z]) => addBox(w, 0.6, d, mats.wall, x, 0.3, z));
      const zBack = -D / 2 - NORTH_STRIP / 2;
      if (W >= 4.4) {
        addBox(1.8, 2.2, 1.8, mats.wall, W / 2 - 1.0, 1.1, zBack);
        addBox(0.8, 1.7, 0.05, mats.dark, W / 2 - 1.0, 0.85, zBack + 0.92);
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 28), mats.tank);
      tank.position.set(-W / 2 + 0.95, 1.15, zBack);
      tank.castShadow = true;
      tank.receiveShadow = true;
      building.add(tank);
      addBox(1.0, 0.6, 1.0, mats.steel, -W / 2 + 0.95, 0.3, zBack);
    };

    updateRef.current = (next) => {
      const now = performance.now();
      const techChanged = next.tech !== cur.tech;
      const kit = panelKit[next.tech] || panelKit.pc;
      const { w: pw, h: ph } = kit.spec;
      const safeArea = Math.max(10, next.area);
      const W = Math.sqrt(safeArea * 1.5);
      const D = safeArea / W;
      if (safeArea !== cur.area) buildRoof(W, D);

      const baseTilt = THREE.MathUtils.degToRad(next.tiltDeg || 26);
      const cols = Math.max(1, Math.floor((W - 0.3) / (pw + 0.03)));
      const rows = Math.max(1, Math.ceil(Math.max(1, next.count) / cols));
      const natural = ph * Math.cos(baseTilt);
      const rowPitch = Math.min(D / rows, natural + 0.85);
      const tilt =
        rowPitch >= natural + 0.04
          ? baseTilt
          : Math.acos(THREE.MathUtils.clamp((rowPitch - 0.04) / ph, 0.15, 1));
      const blockD = rows * rowPitch;
      const z0 = blockD / 2;
      const had = panels.length;

      while (panels.length > next.count) {
        const old = panels.pop()!;
        array.remove(old);
      }

      for (let k = 0; k < next.count; k++) {
        let m = panels[k];
        if (!m) {
          m = new THREE.Mesh(kit.geo, kit.mats);
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.born = now + (k - had) * 28;
          panels.push(m);
          array.add(m);
        }
        if (techChanged) {
          m.geometry = kit.geo;
          m.material = kit.mats;
          m.userData.born = now + k * 14;
        }
        const c = k % cols;
        const r = Math.floor(k / cols);
        const inRow = Math.min(cols, next.count - r * cols);
        m.userData.home = new THREE.Vector3(
          -(inRow * (pw + 0.03)) / 2 + (c + 0.5) * (pw + 0.03),
          Math.sin(tilt) * (ph / 2) + 0.14,
          z0 - rowPitch * (r + 0.5)
        );
        m.rotation.set(-(Math.PI / 2 - tilt), 0, 0);
      }

      const R = Math.hypot(W + 1, D + NORTH_STRIP + 1) / 2;
      wantDist = (R / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.3;
      if (cur.area < 0) dist = wantDist;
      target.set(0, 0.2, -NORTH_STRIP / 2);
      sun.position.set(-R * 1.1, R * 2.3, R * 1.5);
      sun.target.position.copy(target);
      Object.assign(sun.shadow.camera, {
        left: -R * 1.3,
        right: R * 1.3,
        top: R * 1.3,
        bottom: -R * 1.3,
        near: 0.5,
        far: R * 7,
      });
      sun.shadow.camera.updateProjectionMatrix();
      cur = { ...next, area: safeArea };
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.9 ? 40 : 30;
      camera.updateProjectionMatrix();
      if (cur.area > 0) {
        const R =
          Math.hypot(
            Math.sqrt(cur.area * 1.5) + 1,
            cur.area / Math.sqrt(cur.area * 1.5) + NORTH_STRIP + 1
          ) / 2;
        wantDist = (R / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.3;
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let visible = true;
    const io = new IntersectionObserver(
      (es) => {
        visible = es[0].isIntersecting;
      },
      { rootMargin: '200px' }
    );
    io.observe(host);

    let dragging = false;
    let last: [number, number] = [0, 0];
    let yaw = 0;
    let camPitch = 0.62;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = [e.clientX, e.clientY];
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - last[0]) * 0.007;
      camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - last[1]) * 0.004, 0.25, 1.25);
      last = [e.clientX, e.clientY];
    };
    const onUp = () => {
      dragging = false;
      canvas.style.cursor = 'grab';
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') yaw -= 0.15;
      else if (e.key === 'ArrowRight') yaw += 0.15;
      else return;
      e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    updateRef.current({
      tech: techToShortKey(tech),
      count: panelCount,
      area: areaM2,
      tiltDeg,
    });

    const roofTmpV = new THREE.Vector3();
    let rafId = 0;
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (!visible) return;
      for (const m of panels) {
        const t = THREE.MathUtils.clamp((now - (m.userData.born || 0)) / 520, 0, 1);
        const e = 1 - Math.pow(1 - t, 3);
        const home = m.userData.home as THREE.Vector3;
        if (home) {
          m.position.set(home.x, home.y + (1 - e) * 2.2, home.z);
          m.scale.setScalar(0.001 + e * 0.999);
        }
      }
      dist += (wantDist - dist) * 0.08;
      const prog = getProgressRef.current ? getProgressRef.current() : 0.5;
      const az = 0.55 + (prog - 0.5) * 1.5 + yaw;
      camera.position.set(
        target.x + dist * Math.sin(az) * Math.cos(camPitch),
        target.y + dist * Math.sin(camPitch),
        target.z + dist * Math.cos(az) * Math.cos(camPitch)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);

      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w && h) {
        const anchors = [
          {
            pos: new THREE.Vector3(0, 1.05, 0.8),
            label: `${panels.length} modules · ${cur.tiltDeg}° South tilt`,
          },
          {
            pos: new THREE.Vector3(
              0,
              1.9,
              -Math.sqrt((cur.area || 40) / 1.5) / 2 - NORTH_STRIP / 2
            ),
            label: 'North strip · zero array shading',
          },
        ];
        anchors.forEach((a, idx) => {
          const el = roofCalloutRefs.current[idx];
          if (!el) return;
          roofTmpV.copy(a.pos).project(camera);
          el.textContent = a.label;
          el.style.left = `${((roofTmpV.x * 0.5 + 0.5) * w).toFixed(1)}px`;
          el.style.top = `${((-roofTmpV.y * 0.5 + 0.5) * h).toFixed(1)}px`;
        });
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    updateRef.current?.({
      tech: techToShortKey(tech),
      count: panelCount,
      area: areaM2,
      tiltDeg,
    });
  }, [tech, panelCount, areaM2, tiltDeg]);

  return (
    <div ref={hostRef} className={`relative w-full select-none ${heightClass}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        className="h-full w-full cursor-grab touch-pan-y block focus-visible:outline-2 focus-visible:outline-[#ffd166]"
        aria-label="3D model of your roof with the panels that fit on it. Drag or use the arrow keys to turn it."
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            ref={(el) => {
              roofCalloutRefs.current[idx] = el;
            }}
            className="
              absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap
              rounded-full border border-[#3fc1c1]/55 bg-[#05070f]/80 px-2.5 py-0.5
              text-[11px] text-[#f4f5fa] backdrop-blur-md
            "
          />
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
        {isAr ? 'اسحب لتدوير السطح' : 'Drag to turn the roof'}
      </div>
    </div>
  );
}
