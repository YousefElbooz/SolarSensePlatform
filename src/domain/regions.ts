// SolarSense Domain: Egypt's Four Climate Regions & 990 ERA5 Grid Cells
// Inspected from archive/ (lat 23.75..31.75 N, lon 27.75..35.00 E, step 0.25°)

import { AnchorCity, RegionId, RegionInfo, SitePoint } from './types';

export const ERA5_GRID = {
  latMin: 23.75,
  latMax: 31.75,
  lonMin: 27.75,
  lonMax: 35.0,
  step: 0.25,
  rows: 33,
  cols: 30,
  totalCells: 990,
} as const;

export const EGYPT_BOUNDS = {
  latMin: 21.9,
  latMax: 31.8,
  lonMin: 24.6,
  lonMax: 37.0,
} as const;

export const REGIONS: Record<RegionId, RegionInfo> = {
  'north-coast-delta': {
    id: 'north-coast-delta',
    code: 'R1',
    nameEn: 'North Coast & Delta',
    nameAr: 'الساحل الشمالي والدلتا',
    characterEn: 'Higher humidity, Mediterranean winter clouds and rain, cool sea breeze.',
    characterAr: 'رطوبة أعلى، سحب وأمطار شتوية متوسطة، ونسيم بحري معتدل الحرارة.',
    pvBehaviourEn:
      'Lower ambient temperatures reduce thermal losses; periodic winter rain naturally washes dust off panels, while coastal roofs are often space-constrained.',
    pvBehaviourAr:
      'اعتدال الحرارة يقلل الفقد الحراري للألواح، والأمطار الشتوية تنظف الأتربة طبيعياً، مع محدودية مساحة الأسطح السكنية.',
    recommendedTech: 'a-Si:H/sc-Si',
    recommendedReasonEn:
      'Highest efficiency per m² (19–22%) maximizes kWp on compact urban and coastal rooftops.',
    recommendedReasonAr:
      'أعلى كفاءة للمتر المربع (19–22%) لتعظيم القدرة المركبة على الأسطح المحدودة.',
    color: '#3fc1c1',
    avgAnnualGhiKwhM2: 2040,
    summerPeakTempC: 32,
    dustRisk: 'Moderate',
    polygonCoords: [
      [27.75, 30.35],
      [33.4, 30.35],
      [33.4, 31.75],
      [27.75, 31.75],
      [27.75, 30.35],
    ],
  },
  'western-desert': {
    id: 'western-desert',
    code: 'R2',
    nameEn: 'Western Desert & Oases',
    nameAr: 'الصحراء الغربية والواحات',
    characterEn: 'Hyper-arid sky, extreme solar irradiation, wide diurnal temperature swing, spring Khamaseen dust.',
    characterAr: 'سماء شديدة الجفاف، إشعاع شمسي فائق، تباين حراري كبير، ورياح الخماسين في الربيع.',
    pvBehaviourEn:
      'Highest direct normal irradiance (DNI) in Egypt, paired with high cell temperatures and dry dust accumulation requiring scheduled cleaning.',
    pvBehaviourAr:
      'أعلى إشعاع شمسي مباشر في مصر، مع حرارة خلايا مرتفعة وتراكم للغبار يتطلب جدولة للتنظيف.',
    recommendedTech: 'a-Si:H/sc-Si',
    recommendedReasonEn:
      'Ultra-low temperature coefficient (γ = −0.26%/°C) preserves output during 43°C+ oasis afternoons.',
    recommendedReasonAr:
      'معامل حراري منخفض جداً (−0.26%/°م) يحافظ على الإنتاجية في أوقات الذروة الحارة.',
    color: '#f5a524',
    avgAnnualGhiKwhM2: 2460,
    summerPeakTempC: 43,
    dustRisk: 'Extreme (Khamaseen)',
    polygonCoords: [
      [27.75, 23.75],
      [30.65, 23.75],
      [30.65, 30.35],
      [27.75, 30.35],
      [27.75, 23.75],
    ],
  },
  'sinai-red-sea': {
    id: 'sinai-red-sea',
    code: 'R3',
    nameEn: 'Sinai & Red Sea',
    nameAr: 'سيناء والبحر الأحمر',
    characterEn: 'Marine breeze corridor, mountain elevation in South Sinai, coastal aerosol haze.',
    characterAr: 'رياح بحرية نشطة، مرتفعات جبلية في جنوب سيناء، وضباب ساحلي خفيف.',
    pvBehaviourEn:
      'Strong Gulf of Suez wind cools modules effectively; highland sites enjoy crisp air while coastal resorts see diffuse marine light.',
    pvBehaviourAr:
      'الرياح النشطة في خليج السويس تبرد الألواح بكفاءة، مع أداء ممتاز لتقنيات الضوء المنتشر على الساحل.',
    recommendedTech: 'CIGS',
    recommendedReasonEn:
      'Strong spectral response in coastal haze and diffuse sky with solid thermal tolerance (γ = −0.33%/°C).',
    recommendedReasonAr:
      'استجابة طيفية ممتازة في الأجواء الساحلية والضوء المنتشر مع تحمل حراري قوي.',
    color: '#60a5fa',
    avgAnnualGhiKwhM2: 2320,
    summerPeakTempC: 37,
    dustRisk: 'Moderate',
    polygonCoords: [
      [32.3, 23.75],
      [35.0, 23.75],
      [35.0, 31.5],
      [32.3, 31.5],
      [32.3, 23.75],
    ],
  },
  'nile-valley-upper-egypt': {
    id: 'nile-valley-upper-egypt',
    code: 'R4',
    nameEn: 'Nile Valley & Upper Egypt',
    nameAr: 'وادي النيل وصعيد مصر',
    characterEn: 'Strong north-to-south thermal gradient, urban haze in Cairo, world-class sun in Aswan/Benban.',
    characterAr: 'تدرج حراري من القاهرة حتى أسوان، سماء صافية طوال العام في الصعيد ومجمع بنبان.',
    pvBehaviourEn:
      'Exceptional year-round solar yield (up to 2,520 kWh/m² in Aswan), but summer cell temperatures exceed 60°C, penalizing high-|γ| modules.',
    pvBehaviourAr:
      'إنتاجية سنوية استثنائية تصل إلى ذروتها في أسوان وبنبان، لكن حرارة الخلايا تتجاوز 60°م صيفاً.',
    recommendedTech: 'a-Si:H/sc-Si',
    recommendedReasonEn:
      'In Upper Egypt heat, HJT yields +6–8% more kWh per kWp than polycrystalline silicon; pc-Si wins only when budget is strictly capped.',
    recommendedReasonAr:
      'في حرارة الصعيد، تتفوق خلايا HJT بنسبة 6–8% لكل كيلوواط مقارنة بالسيليكون متعدد التبلور.',
    color: '#f97316',
    avgAnnualGhiKwhM2: 2390,
    summerPeakTempC: 45,
    dustRisk: 'High',
    polygonCoords: [
      [30.65, 23.75],
      [33.1, 23.75],
      [32.2, 30.35],
      [30.65, 30.35],
      [30.65, 23.75],
    ],
  },
};

export const ANCHOR_CITIES: AnchorCity[] = [
  // R1: North Coast & Delta
  {
    id: 'alexandria',
    nameEn: 'Alexandria',
    nameAr: 'الإسكندرية',
    lat: 31.2,
    lon: 29.92,
    region: 'north-coast-delta',
    elevationM: 12,
    noteEn: 'Mediterranean coastal city · winter cloud transients',
    noteAr: 'مدينة ساحلية متوسطية · تقلبات سحب شتوية',
  },
  {
    id: 'el-alamein',
    nameEn: 'El Alamein',
    nameAr: 'العلمين الجديدة',
    lat: 30.83,
    lon: 28.95,
    region: 'north-coast-delta',
    elevationM: 18,
    noteEn: 'North Coast anchor inside ERA5 grid (replaces Marsa Matruh)',
    noteAr: 'نقطة الساحل الشمالي داخل شبكة ERA5',
  },
  {
    id: 'tanta',
    nameEn: 'Tanta',
    nameAr: 'طنطا',
    lat: 30.79,
    lon: 31.0,
    region: 'north-coast-delta',
    elevationM: 15,
    noteEn: 'Mid-Delta agricultural & residential hub',
    noteAr: 'قلب الدلتا الزراعي والسكني',
  },
  {
    id: 'port-said',
    nameEn: 'Port Said',
    nameAr: 'بورسعيد',
    lat: 31.26,
    lon: 32.3,
    region: 'north-coast-delta',
    elevationM: 6,
    noteEn: 'East Mediterranean & Suez Canal entrance',
    noteAr: 'شرق المتوسط ومدخل قناة السويس',
  },
  // R2: Western Desert
  {
    id: 'bahariya',
    nameEn: 'Bahariya Oasis',
    nameAr: 'الواحات البحرية',
    lat: 28.35,
    lon: 28.87,
    region: 'western-desert',
    elevationM: 130,
    noteEn: 'Northern oasis · solar pumping corridor',
    noteAr: 'الواحات الشمالية · محور الضخ الشمسي',
  },
  {
    id: 'farafra',
    nameEn: 'Farafra',
    nameAr: 'الفرافرة',
    lat: 27.06,
    lon: 27.97,
    region: 'western-desert',
    elevationM: 85,
    noteEn: 'Western edge of the 990-cell ERA5 archive',
    noteAr: 'الحافة الغربية لشبكة بيانات ERA5',
  },
  {
    id: 'dakhla',
    nameEn: 'Dakhla Oasis',
    nameAr: 'الداخلة',
    lat: 25.49,
    lon: 29.0,
    region: 'western-desert',
    elevationM: 120,
    noteEn: 'Deep Western Desert · very high DNI',
    noteAr: 'عمق الصحراء الغربية · إشعاع مباشر فائق',
  },
  {
    id: 'kharga',
    nameEn: 'Kharga (New Valley)',
    nameAr: 'الخارجة (الوادي الجديد)',
    lat: 25.45,
    lon: 30.55,
    region: 'western-desert',
    elevationM: 78,
    noteEn: 'Primary Western Desert benchmark site',
    noteAr: 'الموقع المرجعي الرئيسي للصحراء الغربية',
  },
  // R3: Sinai & Red Sea
  {
    id: 'el-arish',
    nameEn: 'El Arish',
    nameAr: 'العريش',
    lat: 31.13,
    lon: 33.8,
    region: 'sinai-red-sea',
    elevationM: 22,
    noteEn: 'North Sinai coast',
    noteAr: 'ساحل شمال سيناء',
  },
  {
    id: 'saint-catherine',
    nameEn: 'Saint Catherine',
    nameAr: 'سانت كاترين',
    lat: 28.56,
    lon: 33.95,
    region: 'sinai-red-sea',
    elevationM: 1580,
    noteEn: '~1,580 m high-altitude cool sky',
    noteAr: 'مرتفعات 1580 م · حرارة منخفضة وإشعاع نقي',
  },
  {
    id: 'sharm-el-sheikh',
    nameEn: 'Sharm El-Sheikh',
    nameAr: 'شرم الشيخ',
    lat: 27.91,
    lon: 34.33,
    region: 'sinai-red-sea',
    elevationM: 35,
    noteEn: 'South Sinai solar & hospitality hub',
    noteAr: 'مركز السياحة والطاقة الشمسية بجنوب سيناء',
  },
  {
    id: 'zafarana',
    nameEn: 'Zafarana / Ras Ghareb',
    nameAr: 'الزعفرانة / رأس غارب',
    lat: 28.35,
    lon: 33.08,
    region: 'sinai-red-sea',
    elevationM: 28,
    noteEn: 'High-wind Gulf of Suez renewable corridor',
    noteAr: 'ممر الرياح والطاقة المتجددة بخليج السويس',
  },
  {
    id: 'hurghada',
    nameEn: 'Hurghada',
    nameAr: 'الغردقة',
    lat: 27.26,
    lon: 33.81,
    region: 'sinai-red-sea',
    elevationM: 20,
    noteEn: 'Red Sea coast microgrid & resort load profile',
    noteAr: 'ساحل البحر الأحمر والشبكات المستقلة',
  },
  // R4: Nile Valley & Upper Egypt
  {
    id: 'cairo',
    nameEn: 'Cairo',
    nameAr: 'القاهرة',
    lat: 30.04,
    lon: 31.24,
    region: 'nile-valley-upper-egypt',
    elevationM: 75,
    noteEn: 'Urban reference site · residential & SME rooftops',
    noteAr: 'الموقع الحضري المرجعي · أسطح سكنية وتجارية',
  },
  {
    id: 'minya',
    nameEn: 'Minya',
    nameAr: 'المنيا',
    lat: 28.1,
    lon: 30.75,
    region: 'nile-valley-upper-egypt',
    elevationM: 45,
    noteEn: 'Middle Egypt Nile corridor',
    noteAr: 'ممر وادي النيل في مصر الوسطى',
  },
  {
    id: 'assiut',
    nameEn: 'Assiut',
    nameAr: 'أسيوط',
    lat: 27.18,
    lon: 31.18,
    region: 'nile-valley-upper-egypt',
    elevationM: 56,
    noteEn: 'Upper Egypt transition zone',
    noteAr: 'حاضرة أسيوط ووسط الصعيد',
  },
  {
    id: 'luxor',
    nameEn: 'Luxor',
    nameAr: 'الأقصر',
    lat: 25.69,
    lon: 32.64,
    region: 'nile-valley-upper-egypt',
    elevationM: 88,
    noteEn: 'Southern Nile Valley · high insolation',
    noteAr: 'جنوب الصعيد · سطوع شمسي مرتفع',
  },
  {
    id: 'aswan-benban',
    nameEn: 'Aswan / Benban Solar Park',
    nameAr: 'أسوان / مجمع بنبان الشمسي',
    lat: 24.45,
    lon: 32.74,
    region: 'nile-valley-upper-egypt',
    elevationM: 145,
    noteEn: 'World-scale utility solar park · peak irradiance & heat',
    noteAr: 'مجمع بنبان العالمي · أعلى إشعاع وحرارة في مصر',
  },
];

// Nile corridor centerline [lat, lon] for regional classification
const NILE_SPINE: [number, number][] = [
  [31.75, 31.2],
  [30.0, 31.2],
  [29.0, 31.1],
  [28.1, 30.75],
  [27.2, 31.2],
  [26.2, 32.4],
  [25.7, 32.65],
  [24.1, 32.9],
  [23.75, 32.9],
];

function interpolateNileLon(lat: number): number {
  for (let i = 0; i < NILE_SPINE.length - 1; i++) {
    const [latA, lonA] = NILE_SPINE[i];
    const [latB, lonB] = NILE_SPINE[i + 1];
    if (lat <= latA && lat >= latB) {
      return lonA + ((lonB - lonA) * (latA - lat)) / (latA - latB);
    }
  }
  return lat > NILE_SPINE[0][0] ? NILE_SPINE[0][1] : NILE_SPINE[NILE_SPINE.length - 1][1];
}

export function classifyRegion(lat: number, lon: number): RegionId {
  if (lon >= 32.4 && lat >= 29.0) return 'sinai-red-sea';
  if (lat >= 30.35) return 'north-coast-delta';
  const redSeaCoastLon = 32.6 + (29.0 - lat) * 0.55;
  if (lon >= redSeaCoastLon - 0.7) return 'sinai-red-sea';
  const deltaFromNile = lon - interpolateNileLon(lat);
  if (Math.abs(deltaFromNile) <= 0.65) return 'nile-valley-upper-egypt';
  return deltaFromNile < 0 ? 'western-desert' : 'sinai-red-sea';
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function snapToGridCell(lat: number, lon: number): SitePoint {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const half = ERA5_GRID.step / 2;
  const inCoverage =
    lat >= ERA5_GRID.latMin - half &&
    lat <= ERA5_GRID.latMax + half &&
    lon >= ERA5_GRID.lonMin - half &&
    lon <= ERA5_GRID.lonMax + half;

  const cellLat = clamp(
    Math.round(lat / ERA5_GRID.step) * ERA5_GRID.step,
    ERA5_GRID.latMin,
    ERA5_GRID.latMax
  );
  const cellLon = clamp(
    Math.round(lon / ERA5_GRID.step) * ERA5_GRID.step,
    ERA5_GRID.lonMin,
    ERA5_GRID.lonMax
  );
  const cellId = `${cellLat.toFixed(2)}_${cellLon.toFixed(2)}`;
  const region = classifyRegion(cellLat, cellLon);
  const distanceKm = haversineKm(lat, lon, cellLat, cellLon);

  // Check if near a named anchor city
  let closestAnchor: AnchorCity | undefined;
  let minDist = 45; // within 45 km
  for (const a of ANCHOR_CITIES) {
    const d = haversineKm(cellLat, cellLon, a.lat, a.lon);
    if (d < minDist) {
      minDist = d;
      closestAnchor = a;
    }
  }

  return {
    lat,
    lon,
    cellLat,
    cellLon,
    cellId,
    inCoverage,
    distanceKm: Math.round(distanceKm * 10) / 10,
    region,
    anchorName: closestAnchor?.nameEn,
  };
}

