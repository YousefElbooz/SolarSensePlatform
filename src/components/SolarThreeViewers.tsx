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
