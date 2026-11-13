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
import { Play, Pause, Thermometer, Zap, Eye, Cpu, Compass } from 'lucide-react';

type TwinNodeId = 'sun' | 'array' | 'inverter' | 'battery' | 'load' | 'grid';

interface ProjectedCallout {
  id: TwinNodeId;
  anchorX: number;
  anchorY: number;
  cardX: number;
  cardY: number;
  visible: boolean;
}

function MathFrac({ num, den }: { num: React.ReactNode; den: React.ReactNode }) {
  return (
    <span className="math-frac">
      <span className="num">{num}</span>
      <span className="den">{den}</span>
    </span>
  );
}

// Resolve 2D bounding-box overlaps among the 6 floating 3D equation cards and clamp within canvas bounds
function resolveCalloutCollisions(
  raw: Record<TwinNodeId, ProjectedCallout>,
  width: number,
  height: number
): Record<TwinNodeId, ProjectedCallout> {
  const cardW = 248;
  const cardH = 74;
  const halfW = cardW / 2;
  const padX = halfW + 10;
  const minY = cardH + 10;
  const maxY = height - 42;

  const items = (Object.keys(raw) as TwinNodeId[])
    .filter((id) => raw[id].visible)
    .map((id) => ({
      ...raw[id],
      cardX: Math.max(padX, Math.min(width - padX, raw[id].cardX)),
      cardY: Math.max(minY, Math.min(maxY, raw[id].cardY)),
    }));

  // Iterative relaxation to eliminate any overlapping cards
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.cardX - a.cardX;
        const dy = b.cardY - a.cardY;
        const overlapX = cardW + 12 - Math.abs(dx);
        const overlapY = cardH + 10 - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY * 1.45) {
            const signX = dx >= 0 ? 1 : -1;
            const shiftX = overlapX * 0.52 * signX;
            a.cardX -= shiftX;
            b.cardX += shiftX;
          } else {
            const signY = dy >= 0 ? 1 : -1;
            const shiftY = overlapY * 0.55 * signY;
            a.cardY -= shiftY;
            b.cardY += shiftY;
          }
          a.cardX = Math.max(padX, Math.min(width - padX, a.cardX));
          b.cardX = Math.max(padX, Math.min(width - padX, b.cardX));
          a.cardY = Math.max(minY, Math.min(maxY, a.cardY));
          b.cardY = Math.max(minY, Math.min(maxY, b.cardY));
        }
      }
    }
  }

  const out = { ...raw };
  items.forEach((it) => {
    out[it.id] = {
      ...it,
      cardX: Math.round(it.cardX),
      cardY: Math.round(it.cardY),
    };
  });
  return out;
}

let cachedTwinCellCanvas: HTMLCanvasElement | null = null;

function makeSolarCellTexture(): THREE.CanvasTexture {
  if (!cachedTwinCellCanvas) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 384;
    const g = c.getContext('2d')!;

    g.fillStyle = '#0c1d3e';
    g.fillRect(0, 0, c.width, c.height);

    const cols = 6;
    const rows = 10;
    const pad = 6;
    const cw = (c.width - pad * 2) / cols;
    const ch = (c.height - pad * 2) / rows;

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = pad + col * cw + 1.5;
        const y = pad + r * ch + 1.5;
        const w = cw - 3;
        const h = ch - 3;

        const grad = g.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#16356c');
        grad.addColorStop(0.5, '#1d468a');
        grad.addColorStop(1, '#0f2752');
        g.fillStyle = grad;
        g.fillRect(x, y, w, h);

        // Busbars
        g.fillStyle = 'rgba(220, 232, 250, 0.55)';
        for (let b = 1; b <= 3; b++) {
          g.fillRect(x + (w * b) / 4 - 0.5, y, 1.0, h);
        }
        // Fine fingers
        g.fillStyle = 'rgba(200, 220, 255, 0.16)';
        for (let f = 1; f < 8; f++) {
          g.fillRect(x, y + (h * f) / 8, w, 0.5);
        }
      }
    }
    cachedTwinCellCanvas = c;
  }

  const tex = new THREE.CanvasTexture(cachedTwinCellCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function DigitalTwinContent() {
  const searchParams = useSearchParams();
  const { isAr } = useLanguage();

  const [tech, setTech] = useState<PanelTech>(() =>
    normalizePanelTech(searchParams.get('tech') || 'a-Si:H/sc-Si')
  );
  const [panelCount, setPanelCount] = useState<number>(() => {
    const c = Number(searchParams.get('count') ?? 24);
    return Number.isNaN(c) ? 24 : Math.max(6, Math.min(56, c));
  });
  const [cityId, setCityId] = useState<string>('aswan-benban');
  const [hourLocal, setHourLocal] = useState<number>(12.5);
  const [season, setSeason] = useState<SeasonId>('summer');
  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');
  const [heatmapMode, setHeatmapMode] = useState<'power' | 'temperature'>('power');
  const [playingDay, setPlayingDay] = useState<boolean>(false);
  const [showEquationsHud, setShowEquationsHud] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<TwinNodeId>('array');

  const calloutCardRefs = useRef<Partial<Record<TwinNodeId, HTMLButtonElement | null>>>({});
  const leaderGroupRefs = useRef<Partial<Record<TwinNodeId, SVGGElement | null>>>({});
  const leaderLineRefs = useRef<Partial<Record<TwinNodeId, SVGLineElement | null>>>({});
  const leaderCircleRefs = useRef<Partial<Record<TwinNodeId, SVGCircleElement | null>>>({});

  const city = useMemo(
    () => ANCHOR_CITIES.find((c) => c.id === cityId) || ANCHOR_CITIES[0],
    [cityId]
  );
  const site = useMemo(() => snapToGridCell(city.lat, city.lon), [city]);
  const spec = PANEL_TECHNOLOGIES[tech];
  const systemKwp = Math.round(panelCount * (spec.panelWp / 1000) * 100) / 100;
  const tiltDeg = Math.round(site.cellLat * 0.9);
  const windSpeedMs = 3.8;

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
      windSpeedMs,
      skyCondition,
    });

    const pDcKw =
      Math.round(systemKwp * (irr.poaWm2 / 1000) * pv.tempDerateFactor * 100) / 100;
    const houseLoadKw = Math.round(Math.max(1.2, systemKwp * 0.28) * 100) / 100;
    const surplusKw = Math.max(0, pv.pAcKw - houseLoadKw);
    const batteryChargeKw = Math.round(Math.min(systemKwp * 0.35, surplusKw * 0.65) * 100) / 100;
    const gridExportKw = Math.round(Math.max(0, surplusKw - batteryChargeKw) * 100) / 100;
    const batteryCapKwh = Math.round(systemKwp * 1.6 * 10) / 10;
    const batterySocPct = Math.min(
      98,
      Math.max(20, Math.round(25 + ((hourLocal - 6) / 13) * 70))
    );

    return {
      doy,
      solar,
      irr,
      tAmbC,
      pv,
      pDcKw,
      houseLoadKw,
      surplusKw: Math.round(surplusKw * 100) / 100,
      batteryChargeKw,
      batteryCapKwh,
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
  const cameraTargetRef = useRef<{ yaw: number; pitch: number; dist: number; lookAt: THREE.Vector3 }>({
    yaw: 0.34,
    pitch: 0.54,
    dist: 22.5,
    lookAt: new THREE.Vector3(0, 0.5, -0.7),
  });

  const twinStateRef = useRef({
    telemetry,
    panelCount,
    heatmapMode,
    tiltDeg,
    site,
    season,
    selectedNode,
  });
  twinStateRef.current = {
    telemetry,
    panelCount,
    heatmapMode,
    tiltDeg,
    site,
    season,
    selectedNode,
  };

  const focusCameraOnNode = (nodeId: TwinNodeId | 'overview') => {
    if (nodeId === 'overview') {
      cameraTargetRef.current = {
        yaw: 0.34,
        pitch: 0.54,
        dist: 22.5,
        lookAt: new THREE.Vector3(0, 0.5, -0.7),
      };
      return;
    }
    setSelectedNode(nodeId);
    const presets: Record<TwinNodeId, { yaw: number; pitch: number; dist: number; look: [number, number, number] }> = {
      sun: { yaw: 0.15, pitch: 0.42, dist: 24.0, look: [0, 2.2, 0] },
      array: { yaw: 0.26, pitch: 0.52, dist: 16.5, look: [0, 0.9, 1.0] },
      inverter: { yaw: -0.45, pitch: 0.42, dist: 12.5, look: [-7.4, 1.1, -4.6] },
      battery: { yaw: -0.18, pitch: 0.42, dist: 12.5, look: [-2.5, 1.2, -4.9] },
      load: { yaw: 0.22, pitch: 0.42, dist: 13.0, look: [2.5, 1.3, -4.9] },
      grid: { yaw: 0.52, pitch: 0.44, dist: 14.0, look: [7.4, 1.8, -4.6] },
    };
    const p = presets[nodeId];
    cameraTargetRef.current = {
      yaw: p.yaw,
      pitch: p.pitch,
      dist: p.dist,
      lookAt: new THREE.Vector3(...p.look),
    };
  };

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);

    // Atmospheric & studio lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x3b2f20, 0.58);
    scene.add(hemi);

    const rimLight = new THREE.DirectionalLight(0x3fc1c1, 0.45);
    rimLight.position.set(-14, 9, -12);
    scene.add(rimLight);

    const sunLight = new THREE.DirectionalLight(0xfff3d1, 2.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunLight.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
      near: 1,
      far: 60,
    });
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight, sunLight.target);

    // 1. Engineered Solar Station Ground Pad & Compass Grid (widened for generous component spacing)
    const baseGroup = new THREE.Group();
    const groundPad = new THREE.Mesh(
      new THREE.BoxGeometry(21.4, 0.45, 15.6),
      new THREE.MeshStandardMaterial({ color: 0x161b2e, roughness: 0.85, metalness: 0.15 })
    );
    groundPad.position.set(0, -0.225, -0.2);
    groundPad.receiveShadow = true;
    baseGroup.add(groundPad);

    const roofDeck = new THREE.Mesh(
      new THREE.BoxGeometry(20.0, 0.14, 14.2),
      new THREE.MeshStandardMaterial({ color: 0x242b42, roughness: 0.78, metalness: 0.12 })
    );
    roofDeck.position.set(0, 0.05, -0.2);
    roofDeck.receiveShadow = true;
    baseGroup.add(roofDeck);

    const gridHelper = new THREE.GridHelper(19.6, 24, 0x3fc1c1, 0x334155);
    gridHelper.position.set(0, 0.13, -0.2);
    (gridHelper.material as THREE.Material).opacity = 0.25;
    (gridHelper.material as THREE.Material).transparent = true;
    baseGroup.add(gridHelper);

    const compassRing = new THREE.Mesh(
      new THREE.RingGeometry(7.3, 7.45, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28,
      })
    );
    compassRing.rotation.x = -Math.PI / 2;
    compassRing.position.set(0, 0.14, 0.6);
    baseGroup.add(compassRing);
    scene.add(baseGroup);

    // 2. Astronomical Sun Orb, Corona & Diurnal Sun Path Arc
    const sunOrbGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe082 })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf5a524,
        transparent: true,
        opacity: 0.28,
      })
    );
    sunOrbGroup.add(sunCore, sunHalo);
    scene.add(sunOrbGroup);

    const sunRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.8, 1.2),
      new THREE.Vector3(0, 10, 5),
    ]);
    const sunRayLine = new THREE.Line(
      sunRayGeo,
      new THREE.LineDashedMaterial({
        color: 0xffd166,
        dashSize: 0.4,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.65,
      })
    );
    scene.add(sunRayLine);

    const sunArcMat = new THREE.LineBasicMaterial({
      color: 0xf5a524,
      transparent: true,
      opacity: 0.45,
    });
    const sunArcGeo = new THREE.BufferGeometry();
    const sunArcLine = new THREE.Line(sunArcGeo, sunArcMat);
    scene.add(sunArcLine);

    // 3. Detailed 3D Representation Model: Hybrid String Inverter & MPPT Cabinet
    const inverterGroup = new THREE.Group();
    inverterGroup.position.set(-7.4, 0.12, -4.6);

    const invPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.22, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    invPlinth.position.y = 0.11;
    invPlinth.receiveShadow = true;

    const invFramePostMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.75,
      roughness: 0.3,
    });
    [-0.55, 0.55].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1), invFramePostMat);
      post.position.set(px, 1.1, -0.2);
      post.castShadow = true;
      inverterGroup.add(post);
    });

    const invBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.45, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.28 })
    );
    invBody.position.set(0, 1.25, 0);
    invBody.castShadow = true;

    const invAccentCover = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.95, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf5a524, metalness: 0.35, roughness: 0.32 })
    );
    invAccentCover.position.set(0, 1.38, 0.29);

    const invScreenMat = new THREE.MeshBasicMaterial({ color: 0x3fc1c1 });
    const invScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), invScreenMat);
    invScreen.position.set(0, 1.46, 0.33);

    const dcSwitch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    dcSwitch.rotation.x = Math.PI / 2;
    dcSwitch.position.set(0.36, 0.82, 0.3);

    for (let f = -5; f <= 5; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.35, 0.14), invFramePostMat);
      fin.position.set(f * 0.11, 1.25, -0.33);
      inverterGroup.add(fin);
    }

    inverterGroup.add(invPlinth, invBody, invAccentCover, invScreen, dcSwitch);
    scene.add(inverterGroup);

    // 4. Detailed 3D Representation Model: LiFePO4 BESS Battery Storage Rack
    const batteryGroup = new THREE.Group();
    batteryGroup.position.set(-2.5, 0.12, -4.9);

    const battPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.22, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    battPlinth.position.y = 0.11;
    batteryGroup.add(battPlinth);

    const battCabinetMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.25,
    });
    const battTrimMat = new THREE.MeshStandardMaterial({
      color: 0x3fc1c1,
      metalness: 0.5,
      roughness: 0.3,
    });

    const socBarMeshes: THREE.Mesh[] = [];
    [-0.48, 0.48].forEach((tx) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.85, 0.88), battCabinetMat);
      tower.position.set(tx, 1.14, 0);
      tower.castShadow = true;

      const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.92), battTrimMat);
      topCap.position.set(tx, 2.08, 0);

      for (let m = 0; m < 5; m++) {
        const slot = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.025, 0.03),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 })
        );
        slot.position.set(tx, 0.45 + m * 0.32, 0.45);
        batteryGroup.add(slot);
      }

      const socBg = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.45, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x082f49 })
      );
      socBg.position.set(tx + 0.28, 1.14, 0.45);

      const socFill = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.4, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x3fc1c1 })
      );
      socFill.position.set(tx + 0.28, 1.14, 0.455);
      socBarMeshes.push(socFill);

      batteryGroup.add(tower, topCap, socBg, socFill);
    });
    scene.add(batteryGroup);

    // 5. Detailed 3D Representation Model: Egyptian Villa / Facility Load Building
    const loadGroup = new THREE.Group();
    loadGroup.position.set(2.5, 0.12, -4.9);

    const villaBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.35, 1.75),
      new THREE.MeshStandardMaterial({ color: 0xe2d9c8, roughness: 0.72 })
    );
    villaBase.position.set(0, 0.68, 0);
    villaBase.castShadow = true;
    villaBase.receiveShadow = true;

    const villaUpper = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.95, 1.35),
      new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.68 })
    );
    villaUpper.position.set(-0.28, 1.82, -0.1);
    villaUpper.castShadow = true;

    const parapetTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.58, 0.1, 1.82),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.35, roughness: 0.4 })
    );
    parapetTrim.position.set(0, 1.38, 0);

    const windowMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
    [-0.7, 0, 0.7].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), windowMat);
      win.position.set(wx, 0.72, 0.885);
      loadGroup.add(win);
    });
    const upperWin = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), windowMat);
    upperWin.position.set(-0.28, 1.82, 0.585);
    loadGroup.add(upperWin);

    const hvacBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.35 })
    );
    hvacBox.position.set(0.68, 1.62, 0.15);
    const hvacFanGroup = new THREE.Group();
    hvacFanGroup.position.set(0.68, 1.84, 0.15);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.02, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7 })
      );
      blade.rotation.y = (b * Math.PI) / 4;
      hvacFanGroup.add(blade);
    }

    loadGroup.add(villaBase, villaUpper, parapetTrim, hvacBox, hvacFanGroup);
    scene.add(loadGroup);

    // 6. Detailed 3D Representation Model: EETC High-Voltage Substation & Lattice Pylon
    const gridGroup = new THREE.Group();
    gridGroup.position.set(7.4, 0.12, -4.6);

    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      metalness: 0.75,
      roughness: 0.28,
    });
    const legOffsets: [number, number][] = [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 3.1, 8), pylonMat);
      leg.position.set(lx * 0.7, 1.55, lz * 0.7);
      leg.rotation.z = lx * 0.12;
      leg.rotation.x = -lz * 0.12;
      leg.castShadow = true;
      gridGroup.add(leg);
    });

    [1.8, 2.65].forEach((cy, idx) => {
      const width = idx === 0 ? 1.75 : 1.35;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 0.09), pylonMat);
      arm.position.set(0, cy, 0);
      gridGroup.add(arm);

      [-width / 2 + 0.1, width / 2 - 0.1].forEach((ix) => {
        const insulator = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12),
          new THREE.MeshStandardMaterial({ color: 0xe9d5ff, roughness: 0.2 })
        );
        insulator.position.set(ix, cy - 0.16, 0);
        gridGroup.add(insulator);
      });
    });

    const xfmrBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.95, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x3b0764, metalness: 0.55, roughness: 0.35 })
    );
    xfmrBody.position.set(-0.85, 0.48, 0.25);
    xfmrBody.castShadow = true;
    gridGroup.add(xfmrBody);
    [-1.08, -0.85, -0.62].forEach((bx) => {
      const bushing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.055, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0xd8b4fe, roughness: 0.25 })
      );
      bushing.position.set(bx, 1.1, 0.25);
      gridGroup.add(bushing);
    });
    scene.add(gridGroup);

    // 7. Solar PV Array Group with Textured Modules, Aluminum Frames & Galvanized Racking Legs
    const arrayGroup = new THREE.Group();
    scene.add(arrayGroup);
    const cellTexture = makeSolarCellTexture();
    const panelBodyGeo = new THREE.BoxGeometry(1.06, 1.72, 0.045);
    const frameBarMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.85,
      roughness: 0.22,
    });
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.35,
    });
    const panelMeshes: THREE.Mesh[] = [];

    // 8. 3D Armored Cable Conduits & Animated Energy Flow Streams
    const flowCurves: { curve: THREE.CatmullRomCurve3; color: number }[] = [
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.4, 0.45, 1.0),
          new THREE.Vector3(-4.8, 0.25, -1.5),
          new THREE.Vector3(-7.4, 0.95, -4.3),
        ]),
        color: 0xffd166,
      },
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-6.7, 0.85, -4.6),
          new THREE.Vector3(-4.6, 0.35, -4.8),
          new THREE.Vector3(-2.5, 0.95, -4.7),
        ]),
        color: 0x3fc1c1,
      },
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-6.7, 0.75, -4.5),
          new THREE.Vector3(-2.0, 0.22, -3.5),
          new THREE.Vector3(2.5, 0.85, -4.4),
        ]),
        color: 0x60a5fa,
      },
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-6.7, 0.7, -4.4),
          new THREE.Vector3(0.5, 0.2, -2.9),
          new THREE.Vector3(6.6, 1.05, -4.4),
        ]),
        color: 0xc084fc,
      },
    ];

    const conduitGroup = new THREE.Group();
    const particleGroup = new THREE.Group();
    scene.add(conduitGroup, particleGroup);

    const particleGeo = new THREE.SphereGeometry(0.13, 12, 12);
    const particles: { mesh: THREE.Mesh; pathIdx: number; offset: number }[] = [];

    flowCurves.forEach(({ curve, color }, pIdx) => {
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.045, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.35,
      });
      conduitGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

      const pts = curve.getPoints(40);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
      });
      conduitGroup.add(new THREE.Line(lineGeo, lineMat));

      const pMat = new THREE.MeshBasicMaterial({ color });
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(particleGeo, pMat);
        particleGroup.add(m);
        particles.push({ mesh: m, pathIdx: pIdx, offset: i / 8 });
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

    let curYaw = cameraTargetRef.current.yaw;
    let curPitch = cameraTargetRef.current.pitch;
    let curDist = cameraTargetRef.current.dist;
    const curLookAt = cameraTargetRef.current.lookAt.clone();

    let dragging = false;
    let last: [number, number] = [0, 0];

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = [e.clientX, e.clientY];
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      cameraTargetRef.current.yaw -= (e.clientX - last[0]) * 0.0065;
      cameraTargetRef.current.pitch = Math.max(
        0.18,
        Math.min(1.32, cameraTargetRef.current.pitch + (e.clientY - last[1]) * 0.0045)
      );
      last = [e.clientX, e.clientY];
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraTargetRef.current.dist = Math.max(
        10,
        Math.min(28, cameraTargetRef.current.dist + e.deltaY * 0.01)
      );
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let lastCount = -1;
    let lastTilt = -1;
    let lastArcKey = '';
    let rafId = 0;
    let lastCamKey = '';

    const staticAnchors: Record<Exclude<TwinNodeId, 'sun'>, THREE.Vector3> = {
      array: new THREE.Vector3(0, 1.0, 1.4),
      inverter: new THREE.Vector3(-7.4, 1.85, -4.6),
      battery: new THREE.Vector3(-2.5, 2.15, -4.9),
      load: new THREE.Vector3(2.5, 2.25, -4.9),
      grid: new THREE.Vector3(7.4, 2.85, -4.6),
    };
    const initialOffsetY: Record<TwinNodeId, number> = {
      sun: -18,
      array: -16,
      inverter: -52,
      battery: -12,
      load: -58,
      grid: -14,
    };
    const projVec = new THREE.Vector3();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const {
        telemetry: tel,
        panelCount: count,
        heatmapMode: mode,
        tiltDeg: tilt,
        site: curSite,
        season: curSeason,
      } = twinStateRef.current;

      const arcKey = `${curSite.cellId}-${curSeason}`;
      if (arcKey !== lastArcKey) {
        lastArcKey = arcKey;
        const doy = getDayOfYear(curSeason);
        const arcPts: THREE.Vector3[] = [];
        const sunRadius = 12.8;
        for (let h = 5.5; h <= 18.5; h += 0.25) {
          const sp = computeSolarPosition(curSite.cellLat, curSite.cellLon, h, doy);
          if (sp.elevationDeg > 0) {
            const elR = THREE.MathUtils.degToRad(sp.elevationDeg);
            const azR = THREE.MathUtils.degToRad(sp.azimuthDeg);
            arcPts.push(
              new THREE.Vector3(
                sunRadius * Math.cos(elR) * Math.sin(azR),
                sunRadius * Math.sin(elR),
                -sunRadius * Math.cos(elR) * Math.cos(azR)
              )
            );
          }
        }
        sunArcGeo.setFromPoints(arcPts);
      }

      if (count !== lastCount || tilt !== lastTilt) {
        while (arrayGroup.children.length > 0) {
          arrayGroup.remove(arrayGroup.children[0]);
        }
        panelMeshes.length = 0;

        const cols = 8;
        const tiltRad = THREE.MathUtils.degToRad(tilt);
        for (let k = 0; k < count; k++) {
          const modGroup = new THREE.Group();
          const c = k % cols;
          const r = Math.floor(k / cols);
          const px = (c - (cols - 1) / 2) * 1.32;
          const pz = 4.2 - r * 2.15;
          modGroup.position.set(px, 0.14, pz);

          const frontLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8),
            strutMat
          );
          frontLeg.position.set(0, 0.21, 0.48);
          const rearLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.03, 0.92, 8),
            strutMat
          );
          rearLeg.position.set(0, 0.46, -0.48);
          modGroup.add(frontLeg, rearLeg);

          const mat = new THREE.MeshStandardMaterial({
            map: cellTexture,
            color: 0xffffff,
            roughness: 0.22,
            metalness: 0.42,
          });
          const panelMesh = new THREE.Mesh(panelBodyGeo, mat);
          panelMesh.position.set(0, 0.58, 0);
          panelMesh.rotation.x = -(Math.PI / 2 - tiltRad);
          panelMesh.castShadow = true;
          panelMesh.receiveShadow = true;

          const rim = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.76, 0.035), frameBarMat);
          rim.position.set(0, 0, -0.01);
          panelMesh.add(rim);

          modGroup.add(panelMesh);
          panelMeshes.push(panelMesh);
          arrayGroup.add(modGroup);
        }
        lastCount = count;
        lastTilt = tilt;
      }

      const powerRatio = Math.min(1, tel.pv.pAcKw / Math.max(0.5, count * 0.35));
      const tempNorm = Math.min(1, Math.max(0, (tel.pv.tCellC - 20) / 48));
      panelMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mode === 'power') {
          mat.color.setHSL(0.58 - powerRatio * 0.45, 0.88, 0.42 + powerRatio * 0.32);
          mat.emissive.setHSL(0.11, 0.9, powerRatio * 0.16);
        } else {
          mat.color.setHSL(0.56 * (1 - tempNorm), 0.92, 0.46 + tempNorm * 0.18);
          mat.emissive.setHSL(0.04, 0.95, tempNorm * 0.22);
        }
      });

      const socScale = Math.max(0.08, tel.batterySocPct / 100);
      socBarMeshes.forEach((bar) => {
        bar.scale.y = socScale;
        bar.position.y = 0.44 + (1.4 * socScale) / 2;
      });

      hvacFanGroup.rotation.y = now * 0.008;

      const elevRad = THREE.MathUtils.degToRad(Math.max(2, tel.solar.elevationDeg));
      const azRad = THREE.MathUtils.degToRad(tel.solar.azimuthDeg);
      const sunRadius = 15;
      const sx = sunRadius * Math.cos(elevRad) * Math.sin(azRad);
      const sy = sunRadius * Math.sin(elevRad);
      const sz = -sunRadius * Math.cos(elevRad) * Math.cos(azRad);
      sunLight.position.set(sx, sy, sz);

      const orbPos = new THREE.Vector3(sx * 0.85, sy * 0.85, sz * 0.85);
      sunOrbGroup.position.copy(orbPos);
      sunOrbGroup.visible = tel.solar.elevationDeg > 0;
      sunRayLine.visible = tel.solar.elevationDeg > 0;
      if (tel.solar.elevationDeg > 0) {
        sunRayGeo.setFromPoints([new THREE.Vector3(0, 0.75, 1.2), orbPos]);
        sunRayLine.computeLineDistances();
      }
      sunLight.intensity = tel.solar.elevationDeg > 0 ? 2.5 : 0.08;

      const baseSpeed = 0.00055 * (0.35 + powerRatio * 1.65);
      particles.forEach((p) => {
        const { curve } = flowCurves[p.pathIdx];
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
          const t = (now * baseSpeed + p.offset) % 1;
          curve.getPointAt(t, p.mesh.position);
        }
      });

      curYaw += (cameraTargetRef.current.yaw - curYaw) * 0.09;
      curPitch += (cameraTargetRef.current.pitch - curPitch) * 0.09;
      curDist += (cameraTargetRef.current.dist - curDist) * 0.09;
      curLookAt.lerp(cameraTargetRef.current.lookAt, 0.09);

      camera.position.set(
        curLookAt.x + curDist * Math.sin(curYaw) * Math.cos(curPitch),
        curLookAt.y + curDist * Math.sin(curPitch),
        curLookAt.z + curDist * Math.cos(curYaw) * Math.cos(curPitch)
      );
      camera.lookAt(curLookAt);
      renderer.render(scene, camera);

      // Project 3D Model Anchors to de-overlapped 2D Floating Equation Callouts directly via DOM refs (0 React re-renders)
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) {
        const camKey = `${curYaw.toFixed(4)}|${curPitch.toFixed(4)}|${curDist.toFixed(3)}|${curLookAt.x.toFixed(2)}|${orbPos.x.toFixed(2)}|${orbPos.y.toFixed(2)}|${w}|${h}|${tel.solar.elevationDeg > 0 ? 1 : 0}`;
        if (camKey !== lastCamKey) {
          lastCamKey = camKey;
          const nodeIds: TwinNodeId[] = ['sun', 'array', 'inverter', 'battery', 'load', 'grid'];
          const rawCallouts = {} as Record<TwinNodeId, ProjectedCallout>;
          for (let i = 0; i < nodeIds.length; i++) {
            const id = nodeIds[i];
            const src = id === 'sun' ? orbPos : staticAnchors[id];
            projVec.copy(src).project(camera);
            const ax = (projVec.x * 0.5 + 0.5) * w;
            const ay = (-projVec.y * 0.5 + 0.5) * h;
            const inFront = projVec.z >= -1 && projVec.z <= 1;
            const onScreen = ax >= -20 && ax <= w + 20 && ay >= -20 && ay <= h + 20;
            rawCallouts[id] = {
              id,
              anchorX: Math.round(ax),
              anchorY: Math.round(ay),
              cardX: Math.round(ax),
              cardY: Math.round(ay + initialOffsetY[id]),
              visible: inFront && onScreen && (id !== 'sun' || tel.solar.elevationDeg > 0),
            };
          }

          const resolved = resolveCalloutCollisions(rawCallouts, w, h);
          for (let i = 0; i < nodeIds.length; i++) {
            const id = nodeIds[i];
            const pos = resolved[id];
            const cardEl = calloutCardRefs.current[id];
            const groupEl = leaderGroupRefs.current[id];
            const lineEl = leaderLineRefs.current[id];
            const circleEl = leaderCircleRefs.current[id];

            if (cardEl) {
              if (pos.visible) {
                cardEl.style.display = 'block';
                cardEl.style.left = `${pos.cardX}px`;
                cardEl.style.top = `${pos.cardY}px`;
              } else {
                cardEl.style.display = 'none';
              }
            }
            if (groupEl) {
              groupEl.style.display = pos.visible ? '' : 'none';
            }
            if (lineEl && pos.visible) {
              lineEl.setAttribute('x1', String(pos.anchorX));
              lineEl.setAttribute('y1', String(pos.anchorY));
              lineEl.setAttribute('x2', String(pos.cardX));
              lineEl.setAttribute('y2', String(pos.cardY - 6));
            }
            if (circleEl && pos.visible) {
              circleEl.setAttribute('cx', String(pos.anchorX));
              circleEl.setAttribute('cy', String(pos.anchorY));
            }
          }
        }
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      cellTexture.dispose();
      renderer.dispose();
    };
  }, []);

  const clockStr = `${String(Math.floor(hourLocal)).padStart(2, '0')}:${String(
    Math.floor((hourLocal % 1) * 60)
  ).padStart(2, '0')} · 3D Twin`;

  // Typeset mathematical equations and live metrics for all 6 subsystem models
  const nodeBadges: Array<{
    id: TwinNodeId;
    pillLabel: React.ReactNode;
    title: React.ReactNode;
    color: string;
    borderColor: string;
    equationNode: React.ReactNode;
    subFormulaNode: React.ReactNode;
    liveMetricNode: React.ReactNode;
    substitutionNode: React.ReactNode;
  }> = [
    {
      id: 'sun',
      pillLabel: (
        <>
          01 · Solar Geometry (<i className="font-serif">α</i>
          <sub>s</sub>, <i className="font-serif">γ</i>
          <sub>s</sub>)
        </>
      ),
      title: isAr ? (
        '01 · الهندسة الفلكية للشمس'
      ) : (
        <>
          01 · Solar Geometry (<i className="font-serif">α</i>
          <sub>s</sub>, <i className="font-serif">γ</i>
          <sub>s</sub>)
        </>
      ),
      color: '#ffd166',
      borderColor: 'rgba(255, 209, 102, 0.48)',
      equationNode: (
        <span className="math-expr">
          <span className="m-fn">sin</span> α<sub>s</sub> <span className="m-op">=</span>{' '}
          <span className="m-fn">sin</span> φ <span className="m-fn">sin</span> δ{' '}
          <span className="m-op">+</span> <span className="m-fn">cos</span> φ{' '}
          <span className="m-fn">cos</span> δ <span className="m-fn">cos</span> ω
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <span>
            <i>G</i>
            <sub>h</sub> <span className="m-op">=</span> <i>k</i>
            <sub>c</sub> · <i>G</i>
            <sub>h,clr</sub>
          </span>
          <span className="m-op mx-1.5">|</span>
          <span>
            <span className="m-fn">AM</span> <span className="m-op">=</span>{' '}
            <MathFrac
              num={<span className="m-num">1</span>}
              den={
                <>
                  <span className="m-fn">sin</span> α<sub>s</sub> <span className="m-op">+</span>{' '}
                  <span className="m-num">0.506</span>(α<sub>s</sub>{' '}
                  <span className="m-op">+</span> <span className="m-num">6.08°</span>)
                  <sup>−1.636</sup>
                </>
              }
            />
          </span>
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          α<sub>s</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.solar.elevationDeg.toFixed(1)}°</span>
          <span className="m-op">·</span>
          γ<sub>s</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.solar.azimuthDeg.toFixed(0)}°</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          φ <span className="m-op">=</span>{' '}
          <span className="m-num">{site.cellLat.toFixed(2)}°N</span>, <i>N</i>{' '}
          <span className="m-op">=</span> <span className="m-num">{telemetry.doy}</span>{' '}
          <span className="m-op">⇒</span> <i>G</i>
          <sub>h</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{Math.round(telemetry.irr.ghiWm2)}</span>{' '}
          <span className="m-unit">W/m²</span> (<i>k</i>
          <sub>c</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.irr.kc.toFixed(2)}</span>)
        </span>
      ),
    },
    {
      id: 'array',
      pillLabel: (
        <>
          02 · PV Array &amp; Faiman <i className="font-serif">T</i>
          <sub>c</sub>
        </>
      ),
      title: isAr ? (
        '02 · مصفوفة الألواح وحرارة الخلية'
      ) : (
        <>
          02 · PV Array &amp; Faiman <i className="font-serif">T</i>
          <sub>c</sub>
        </>
      ),
      color: '#f5a524',
      borderColor: 'rgba(245, 165, 36, 0.58)',
      equationNode: (
        <span className="math-expr">
          <i>T</i>
          <sub>c</sub> <span className="m-op">=</span> <i>T</i>
          <sub>a</sub> <span className="m-op">+</span>{' '}
          <MathFrac
            num={
              <>
                <i>G</i>
                <sub>POA</sub>
              </>
            }
            den={
              <>
                <i>U</i>
                <sub>0</sub> <span className="m-op">+</span> <i>U</i>
                <sub>1</sub> <i>v</i>
                <sub>w</sub>
              </>
            }
          />
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <i>G</i>
          <sub>POA</sub> <span className="m-op">=</span> <i>G</i>
          <sub>b</sub> <span className="m-fn">cos</span> θ<sub>i</sub>{' '}
          <span className="m-op">+</span> <i>G</i>
          <sub>d</sub>{' '}
          <MathFrac
            num={
              <>
                <span className="m-num">1</span> <span className="m-op">+</span>{' '}
                <span className="m-fn">cos</span> β
              </>
            }
            den={<span className="m-num">2</span>}
          />{' '}
          <span className="m-op">+</span> ρ <i>G</i>
          <sub>h</sub>{' '}
          <MathFrac
            num={
              <>
                <span className="m-num">1</span> <span className="m-op">−</span>{' '}
                <span className="m-fn">cos</span> β
              </>
            }
            den={<span className="m-num">2</span>}
          />
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          <i>G</i>
          <sub>POA</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{Math.round(telemetry.irr.poaWm2)}</span>{' '}
          <span className="m-unit">W/m²</span>
          <span className="m-op">·</span>
          <i>T</i>
          <sub>c</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.pv.tCellC}°C</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          <i>T</i>
          <sub>c</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.tAmbC}°C</span> <span className="m-op">+</span>{' '}
          <MathFrac
            num={<span className="m-num">{Math.round(telemetry.irr.poaWm2)}</span>}
            den={
              <>
                <span className="m-num">25.0</span> <span className="m-op">+</span>{' '}
                <span className="m-num">6.84</span> <span className="m-op">×</span>{' '}
                <span className="m-num">{windSpeedMs}</span>
              </>
            }
          />{' '}
          <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.pv.tCellC}°C</span> (β <span className="m-op">=</span>{' '}
          <span className="m-num">{tiltDeg}°</span>)
        </span>
      ),
    },
    {
      id: 'inverter',
      pillLabel: (
        <>
          03 · Hybrid Inverter (<i className="font-serif">P</i>
          <sub>AC</sub>)
        </>
      ),
      title: isAr ? (
        '03 · العاكس الهجين (MPPT)'
      ) : (
        <>
          03 · Hybrid Inverter (<i className="font-serif">P</i>
          <sub>AC</sub>)
        </>
      ),
      color: '#ffd166',
      borderColor: 'rgba(255, 209, 102, 0.52)',
      equationNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>AC</sub> <span className="m-op">=</span> η<sub>inv</sub> <i>P</i>
          <sub>STC</sub>{' '}
          <MathFrac
            num={
              <>
                <i>G</i>
                <sub>POA</sub>
              </>
            }
            den={<span className="m-num">1000</span>}
          />
          <span className="m-op">[</span>
          <span className="m-num">1</span> <span className="m-op">+</span> γ(<i>T</i>
          <sub>c</sub> <span className="m-op">−</span> <span className="m-num">25</span>)
          <span className="m-op">]</span>
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <i>f</i>
          <sub>T</sub> <span className="m-op">=</span> <span className="m-num">1</span>{' '}
          <span className="m-op">+</span> γ(<i>T</i>
          <sub>c</sub> <span className="m-op">−</span> <span className="m-num">25°C</span>)
          <span className="m-op mx-1.5">|</span>
          η<sub>sys</sub> <span className="m-op">=</span> (<span className="m-num">1</span>{' '}
          <span className="m-op">−</span> <i>L</i>
          <sub>sys</sub>) · η<sub>inv</sub>
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>AC</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.pv.pAcKw}</span> <span className="m-unit">kW</span>
          <span className="m-op">·</span>
          <i>f</i>
          <sub>T</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{(telemetry.pv.tempDerateFactor * 100).toFixed(1)}%</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          <i>P</i>
          <sub>AC</sub> <span className="m-op">=</span> <span className="m-num">0.849</span>{' '}
          <span className="m-op">×</span> <span className="m-num">{systemKwp}</span>{' '}
          <span className="m-op">×</span>{' '}
          <MathFrac
            num={<span className="m-num">{Math.round(telemetry.irr.poaWm2)}</span>}
            den={<span className="m-num">1000</span>}
          />{' '}
          <span className="m-op">×</span> [<span className="m-num">1</span>{' '}
          <span className="m-op">+</span> (<span className="m-num">{spec.tempCoeffPctPerC}%</span>
          )(<span className="m-num">{telemetry.pv.tCellC}</span> <span className="m-op">−</span>{' '}
          <span className="m-num">25</span>)] <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.pv.pAcKw}</span> <span className="m-unit">kW</span>
        </span>
      ),
    },
    {
      id: 'battery',
      pillLabel: (
        <>
          04 · LiFePO<sub>4</sub> BESS (<i className="font-serif">SoC</i>)
        </>
      ),
      title: isAr ? (
        '04 · بطاريات LiFePO₄'
      ) : (
        <>
          04 · LiFePO<sub>4</sub> BESS (<i className="font-serif">SoC</i>)
        </>
      ),
      color: '#3fc1c1',
      borderColor: 'rgba(63, 193, 193, 0.58)',
      equationNode: (
        <span className="math-expr">
          <span className="m-fn">SoC</span>(<i>t</i>
          <span className="m-op">+</span>Δ<i>t</i>) <span className="m-op">=</span>{' '}
          <span className="m-fn">SoC</span>(<i>t</i>) <span className="m-op">+</span>{' '}
          <MathFrac
            num={
              <>
                η<sub>ch</sub> <i>P</i>
                <sub>ch</sub> Δ<i>t</i>
              </>
            }
            den={
              <>
                <i>E</i>
                <sub>cap</sub>
              </>
            }
          />
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <i>P</i>
          <sub>ch</sub> <span className="m-op">=</span> <span className="m-fn">min</span>
          <span className="m-op">(</span>
          <span className="m-num">0.35</span> <i>P</i>
          <sub>STC</sub>, <span className="m-num">0.65</span> · <span className="m-fn">max</span>(
          <span className="m-num">0</span>, <i>P</i>
          <sub>AC</sub> <span className="m-op">−</span> <i>P</i>
          <sub>load</sub>)<span className="m-op">)</span>
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>ch</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.batteryChargeKw}</span>{' '}
          <span className="m-unit">kW</span>
          <span className="m-op">·</span>
          <span className="m-fn">SoC</span> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.batterySocPct}%</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          <i>E</i>
          <sub>cap</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.batteryCapKwh}</span>{' '}
          <span className="m-unit">kWh</span>, η<sub>ch</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">95%</span>, <i>P</i>
          <sub>ch</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.batteryChargeKw}</span>{' '}
          <span className="m-unit">kW</span> <span className="m-op">⇒</span>{' '}
          <span className="m-fn">SoC</span> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.batterySocPct}%</span>
        </span>
      ),
    },
    {
      id: 'load',
      pillLabel: (
        <>
          05 · Facility Load (<i className="font-serif">P</i>
          <sub>load</sub>)
        </>
      ),
      title: isAr ? (
        '05 · أحمال المبنى والتكييف'
      ) : (
        <>
          05 · Facility &amp; HVAC (<i className="font-serif">P</i>
          <sub>load</sub>)
        </>
      ),
      color: '#60a5fa',
      borderColor: 'rgba(96, 165, 250, 0.58)',
      equationNode: (
        <span className="math-expr">
          Δ<i>P</i>
          <sub>sur</sub> <span className="m-op">=</span> <span className="m-fn">max</span>
          <span className="m-op">(</span>
          <span className="m-num">0</span>, <i>P</i>
          <sub>AC</sub> <span className="m-op">−</span> <i>P</i>
          <sub>load</sub>
          <span className="m-op">)</span>
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <span className="m-fn">SSR</span> <span className="m-op">=</span>{' '}
          <span className="m-fn">min</span>
          <span className="m-op">(</span>
          <span className="m-num">100%</span>,{' '}
          <MathFrac
            num={
              <>
                <i>P</i>
                <sub>AC</sub>
              </>
            }
            den={
              <>
                <i>P</i>
                <sub>load</sub>
              </>
            }
          />{' '}
          <span className="m-op">×</span> <span className="m-num">100%</span>
          <span className="m-op">)</span>
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>load</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.houseLoadKw}</span>{' '}
          <span className="m-unit">kW</span>
          <span className="m-op">·</span>
          Δ<i>P</i>
          <sub>sur</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.surplusKw}</span> <span className="m-unit">kW</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          Δ<i>P</i>
          <sub>sur</sub> <span className="m-op">=</span> <span className="m-fn">max</span>(
          <span className="m-num">0</span>, <span className="m-num">{telemetry.pv.pAcKw}</span>{' '}
          <span className="m-op">−</span> <span className="m-num">{telemetry.houseLoadKw}</span>){' '}
          <span className="m-op">=</span> <span className="m-num">{telemetry.surplusKw}</span>{' '}
          <span className="m-unit">kW</span>
        </span>
      ),
    },
    {
      id: 'grid',
      pillLabel: (
        <>
          06 · EETC Grid (<i className="font-serif">P</i>
          <sub>grid</sub>)
        </>
      ),
      title: isAr ? (
        '06 · محطة الربط بالشبكة'
      ) : (
        <>
          06 · EETC Grid (<i className="font-serif">P</i>
          <sub>grid</sub>)
        </>
      ),
      color: '#c084fc',
      borderColor: 'rgba(192, 132, 252, 0.58)',
      equationNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>grid</sub> <span className="m-op">=</span> <span className="m-fn">max</span>
          <span className="m-op">(</span>
          <span className="m-num">0</span>, Δ<i>P</i>
          <sub>sur</sub> <span className="m-op">−</span> <i>P</i>
          <sub>ch</sub>
          <span className="m-op">)</span>
        </span>
      ),
      subFormulaNode: (
        <span className="math-expr math-expr-wrap">
          <i>R</i>
          <sub>EETC</sub> <span className="m-op">=</span> ∫ <i>P</i>
          <sub>AC</sub>(<i>t</i>) · <i>c</i>
          <sub>tariff</sub> d<i>t</i>
        </span>
      ),
      liveMetricNode: (
        <span className="math-expr">
          <i>P</i>
          <sub>exp</sub> <span className="m-op">=</span>{' '}
          <span className="m-num">{telemetry.gridExportKw}</span>{' '}
          <span className="m-unit">kW</span>
        </span>
      ),
      substitutionNode: (
        <span className="math-expr math-expr-wrap">
          <i>P</i>
          <sub>grid</sub> <span className="m-op">=</span> <span className="m-fn">max</span>(
          <span className="m-num">0</span>, <span className="m-num">{telemetry.surplusKw}</span>{' '}
          <span className="m-op">−</span>{' '}
          <span className="m-num">{telemetry.batteryChargeKw}</span>){' '}
          <span className="m-op">=</span> <span className="m-num">{telemetry.gridExportKw}</span>{' '}
          <span className="m-unit">kW</span>
        </span>
      ),
    },
  ];

  const activeNodeMeta = nodeBadges.find((n) => n.id === selectedNode) || nodeBadges[1];

  return (
    <div className="cinematic-page pb-16 pt-8">
      <Navbar clockLabel={clockStr} />

      {/* Expanded max-w-[1680px] container so all equations and 3D HUD badges have full horizontal room */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              {isAr
                ? 'التوأم الرقمي الهندسي ثلاثي الأبعاد + المعادلات الرياضية الحية'
                : 'Engineering 3D Digital Twin · Live Mathematical Formulations & Models'}
            </div>
            <h1 className="cinematic-h2 mt-2">
              {isAr ? (
                'محاكاة فيزيائية حية للمصفوفة، العاكس، البطاريات، الأحمال والشبكة'
              ) : (
                <>
                  True astronomical sun path,{' '}
                  <em className="font-normal italic text-[#ffd166]">3D component models</em> &amp;
                  typeset governing equations
                </>
              )}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEquationsHud((s) => !s)}
              className={showEquationsHud ? 'btn-pill-primary' : 'btn-pill'}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isAr ? 'المعادلات العائمة 3D' : '3D Math HUDs'}</span>
            </button>

            <button
              type="button"
              onClick={() => setHeatmapMode('power')}
              className={heatmapMode === 'power' ? 'btn-pill-primary' : 'btn-pill'}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>
                {isAr ? 'خريطة القدرة' : 'Power'} (<i className="font-serif">P</i>
                <sub>AC</sub>)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setHeatmapMode('temperature')}
              className={heatmapMode === 'temperature' ? 'btn-pill-primary' : 'btn-pill'}
            >
              <Thermometer className="h-3.5 w-3.5" />
              <span>
                {isAr ? 'حرارة الخلية' : 'Cell Temp'} (<i className="font-serif">T</i>
                <sub>c</sub>)
              </span>
            </button>
          </div>
        </div>

        {/* Single-Row Camera Focus & Subsystem Selector Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => focusCameraOnNode('overview')}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs text-[#f4f5fa] transition hover:border-[#ffd166]"
          >
            <Compass className="mr-1.5 inline h-3.5 w-3.5 text-[#ffd166]" />
            {isAr ? 'مشهد شامل (Overview)' : 'Full Plant Overview'}
          </button>
          {nodeBadges.map((node) => {
            const active = selectedNode === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => focusCameraOnNode(node.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                  active
                    ? 'border-[#ffd166] bg-[#f5a524]/20 font-semibold text-[#ffd166]'
                    : 'border-white/12 bg-white/[0.03] text-[#b9bdcf] hover:border-white/30 hover:text-white'
                }`}
              >
                {node.pillLabel}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-12">
          {/* 3D Scene Stage + De-Overlapped Floating Math Callouts + Scrubber Bar */}
          <div className="glass xl:col-span-8">
            <div
              ref={hostRef}
              className="relative h-[560px] w-full overflow-hidden rounded-2xl border border-white/[0.14] bg-[#05070f]"
            >
              <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab active:cursor-grabbing"
                aria-label="3D Engineering Digital Twin Scene"
              />

              {/* SVG Leader Lines connecting de-overlapped equation cards to exact 3D model anchors */}
              <svg
                className={`pointer-events-none absolute inset-0 h-full w-full ${showEquationsHud ? '' : 'hidden'}`}
                aria-hidden="true"
              >
                {nodeBadges.map((b) => {
                  const isSel = selectedNode === b.id;
                  return (
                    <g
                      key={`leader-${b.id}`}
                      ref={(el) => {
                        leaderGroupRefs.current[b.id] = el;
                      }}
                    >
                      <line
                        ref={(el) => {
                          leaderLineRefs.current[b.id] = el;
                        }}
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={0}
                        stroke={isSel ? '#ffd166' : b.color}
                        strokeWidth={isSel ? 1.8 : 1.2}
                        strokeDasharray="3 3"
                        strokeOpacity={isSel ? 0.95 : 0.65}
                      />
                      <circle
                        ref={(el) => {
                          leaderCircleRefs.current[b.id] = el;
                        }}
                        cx={0}
                        cy={0}
                        r={3.5}
                        fill={b.color}
                        stroke="#05070f"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* 3D-Projected Typeset Math Equation Cards (Never Clipping or Overlapping) */}
              <div className={showEquationsHud ? '' : 'hidden'}>
                {nodeBadges.map((b) => {
                  const isSel = selectedNode === b.id;
                  return (
                    <button
                      key={b.id}
                      ref={(el) => {
                        calloutCardRefs.current[b.id] = el;
                      }}
                      type="button"
                      onClick={() => focusCameraOnNode(b.id)}
                      style={{
                        borderColor: isSel ? '#ffd166' : b.borderColor,
                      }}
                      className={`group absolute z-10 w-max max-w-[270px] -translate-x-1/2 -translate-y-full cursor-pointer rounded-xl border bg-[#060916]/90 px-3 py-1.5 text-left backdrop-blur-md transition-shadow duration-200 ${
                        isSel
                          ? 'ring-2 ring-[#ffd166]/55 shadow-[0_0_24px_rgba(245,165,36,0.35)]'
                          : 'hover:border-[#ffd166]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[10.5px] font-bold tracking-wide whitespace-nowrap"
                          style={{ color: b.color }}
                        >
                          {b.title}
                        </span>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#f4f5fa]">{b.equationNode}</div>
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: b.color }}>
                        {b.liveMetricNode}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom-left Interaction Hint */}
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/12 bg-[#05070f]/80 px-3.5 py-1 font-mono text-[11px] text-[#b9bdcf] backdrop-blur-md">
                {isAr
                  ? 'اسحب للدوران 3D · عجلة الفأرة للتقريب · انقر على أي بطاقة معادلة للتركيز'
                  : 'Drag to orbit 3D models · Scroll to zoom · Click any equation card to focus'}
              </div>
            </div>

            {/* Live Selected Model Governing Equation & Numerical Substitution Inspector */}
            <div className="mt-4 rounded-2xl border border-[#ffd166]/35 bg-[#0a0f22]/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[#ffd166]" />
                  <span className="text-xs font-bold tracking-wide text-[#ffd166]">
                    {activeNodeMeta.title} —{' '}
                    {isAr
                      ? 'المعادلة الرياضية الحاكمة والتعويض الرقمي اللحظي'
                      : 'Governing Mathematical Formulation & Real-Time Substitution'}
                  </span>
                </div>
                <span className="tag-pill live">{activeNodeMeta.liveMetricNode}</span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#b9bdcf]">
                    {isAr ? 'الصيغة الرياضية (Symbolic Formulation)' : 'Symbolic Formulation'}
                  </div>
                  <div className="mt-1.5 text-[14px] text-white">{activeNodeMeta.equationNode}</div>
                  <div className="mt-1.5 text-[12.5px] text-[#9fe9e9]">
                    {activeNodeMeta.subFormulaNode}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#b9bdcf]">
                    {isAr
                      ? 'التعويض الفوري (Real-Time Solver State)'
                      : 'Real-Time Numerical Substitution'}
                  </div>
                  <div className="mt-2 text-[13.5px] text-[#ffd166]">
                    {activeNodeMeta.substitutionNode}
                  </div>
                </div>
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

                <div className="min-w-[220px] flex-1 px-2">
                  <div className="flex justify-between text-xs text-[#b9bdcf]">
                    <span>Local Solar Time</span>
                    <span className="math-expr text-[#ffd166]">
                      <span className="m-num">
                        {String(Math.floor(hourLocal)).padStart(2, '0')}:
                        {String(Math.floor((hourLocal % 1) * 60)).padStart(2, '0')}
                      </span>
                      <span className="m-op">·</span>α<sub>s</sub> <span className="m-op">=</span>{' '}
                      <span className="m-num">{telemetry.solar.elevationDeg.toFixed(1)}°</span>
                      <span className="m-op">·</span>γ<sub>s</sub> <span className="m-op">=</span>{' '}
                      <span className="m-num">{telemetry.solar.azimuthDeg.toFixed(0)}°</span>
                    </span>
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
                    Site Location (φ, λ)
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
                    Season (δ)
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
                    Sky Condition (
                    <i className="font-serif lowercase">k</i>
                    <sub>c</sub>)
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

          {/* Live Telemetry & Complete 6-Node Typeset Equation Ledger Sidebar */}
          <div className="glass flex flex-col justify-between xl:col-span-4">
            <div>
              <div className="eyebrow">Live Twin Telemetry &amp; Equations</div>
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
                    <span>
                      Array Module Count (<i className="font-serif">N</i>
                      <sub>mod</sub>)
                    </span>
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

              {/* 4 KPI Cards with Real Mathematical Symbols */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    AC Power (<i className="font-serif italic">P</i>
                    <sub>AC</sub>)
                  </div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#ffd166]">
                    {telemetry.pv.pAcKw} kW
                  </div>
                  <div className="math-expr mt-0.5 text-[11px] text-[#b9bdcf]">
                    <i>P</i>
                    <sub>DC</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">{telemetry.pDcKw}</span> <span className="m-op">·</span>{' '}
                    <i>P</i>
                    <sub>clr</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">{telemetry.pv.pClearKw}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Faiman Cell Temp (<i className="font-serif italic">T</i>
                    <sub>c</sub>)
                  </div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#ffd166]">
                    {telemetry.pv.tCellC} °C
                  </div>
                  <div className="math-expr mt-0.5 text-[11px] text-[#b9bdcf]">
                    <i>T</i>
                    <sub>a</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">{telemetry.tAmbC}°C</span>{' '}
                    <span className="m-op">·</span> <i>f</i>
                    <sub>T</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">
                      {(telemetry.pv.tempDerateFactor * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Tilted POA (<i className="font-serif italic">G</i>
                    <sub>POA</sub>)
                  </div>
                  <div className="mt-1 font-serif text-2xl font-bold text-white">
                    {Math.round(telemetry.irr.poaWm2)} W/m²
                  </div>
                  <div className="math-expr mt-0.5 text-[11px] text-[#9fe9e9]">
                    <i>G</i>
                    <sub>b</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">{Math.round(telemetry.irr.dniWm2)}</span>{' '}
                    <span className="m-op">·</span> <i>G</i>
                    <sub>d</sub> <span className="m-op">=</span>{' '}
                    <span className="m-num">{Math.round(telemetry.irr.dhiWm2)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#b9bdcf]">
                    Perf. Ratio (η<sub>PR</sub>)
                  </div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#9fe9e9]">
                    {Math.round(telemetry.pv.performanceRatio * 100)}%
                  </div>
                  <div className="math-expr mt-0.5 text-[11px] text-[#b9bdcf]">
                    <span className="m-fn">SoC</span> <span className="m-op">=</span>{' '}
                    <span className="m-num">{telemetry.batterySocPct}%</span>
                  </div>
                </div>
              </div>

              {/* Interactive 6-Model Typeset Equation Stack */}
              <div className="mt-5 space-y-2.5">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#b9bdcf]">
                  {isAr ? 'النماذج الهندسية الستة ومعادلاتها:' : '3D Subsystem Models & Equations:'}
                </div>
                {nodeBadges.map((n) => {
                  const active = selectedNode === n.id;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => focusCameraOnNode(n.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? 'border-[#ffd166] bg-[#f5a524]/15'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-white">{n.title}</span>
                        <span className="text-xs" style={{ color: n.color }}>
                          {n.liveMetricNode}
                        </span>
                      </div>
                      <div className="mt-1 text-[12.5px] text-[#e2e8f0]">{n.equationNode}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3 text-[11.5px] text-[#b9bdcf]">
              <b className="text-white">Coupled Solver Chain:</b>{' '}
              <span className="math-expr math-expr-wrap">
                δ(<i>N</i>
                <span className="m-op">=</span>
                <span className="m-num">{telemetry.doy}</span>) <span className="m-op">→</span>{' '}
                <i>G</i>
                <sub>POA</sub>(β<span className="m-op">=</span>
                <span className="m-num">{tiltDeg}°</span>) <span className="m-op">→</span> <i>T</i>
                <sub>c</sub> <span className="m-op">→</span> <i>P</i>
                <sub>AC</sub>(γ<span className="m-op">=</span>
                <span className="m-num">{spec.tempCoeffPctPerC}%/°C</span>){' '}
                <span className="m-op">→</span> <span className="m-fn">SoC</span> &amp; <i>P</i>
                <sub>grid</sub>
              </span>
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
