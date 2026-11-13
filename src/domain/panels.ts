// SolarSense Domain: Three Panel Technologies & Economic Assumptions
// Platform Context §4: pc-Si, a-Si:H/sc-Si (HJT), CIGS

import { PanelTech, PanelTechnologyInfo } from './types';

export const PANEL_TECHNOLOGIES: Record<PanelTech, PanelTechnologyInfo> = {
  'pc-Si': {
    key: 'pc-Si',
    shortKey: 'pc',
    nameEn: 'Polycrystalline Silicon',
    nameAr: 'سيليكون متعدد التبلور (pc-Si)',
    subtitleEn: 'pc-Si · The affordable workhorse',
    subtitleAr: 'الخيار الاقتصادي واسع الانتشار',
    efficiencyRange: '15–18 %',
    efficiencyNominalPct: 17.0,
    tempCoeffRange: '−0.40 to −0.45 %/°C',
    tempCoeffPctPerC: -0.42,
    degradationPctPerYear: 0.65,
    panelWp: 330,
    panelAreaM2: 1.94,
    noctC: 45,
    areaPerKwpLabel: '~6 m²',
    priceTier: '●○○',
    pricePerWpEgp: 28,
    bestFitEn: 'Budget-limited installations with generous roof or ground space',
    bestFitAr: 'الميزانيات المحدودة مع توفر مساحة سطح أو أرض كافية',
    calloutsEn: [
      'Blue grained multicrystalline wafer · 60 cells',
      'Thermal loss γ = −0.42%/°C above 25°C STC',
      'Anodized silver Al frame · 330 Wp (1.94 m²)',
    ],
    calloutsAr: [
      'خلايا سيليكون متعددة التبلور · 60 خلية',
      'الفقد الحراري −0.42% لكل درجة فوق 25°م',
      'إطار ألومنيوم مؤكسد · 330 واط (1.94 م²)',
    ],
  },
  'a-Si:H/sc-Si': {
    key: 'a-Si:H/sc-Si',
    shortKey: 'hjt',
    nameEn: 'Heterojunction (HJT)',
    nameAr: 'خلايا هجينة غير متجانسة (HJT)',
    subtitleEn: 'a-Si:H / sc-Si · Premium desert & compact-roof performer',
    subtitleAr: 'الأداء الفائق في الحرارة العالية والأسطح المحدودة',
    efficiencyRange: '19–22 %',
    efficiencyNominalPct: 20.6,
    tempCoeffRange: '−0.25 to −0.30 %/°C',
    tempCoeffPctPerC: -0.26,
    degradationPctPerYear: 0.4,
    panelWp: 400,
    panelAreaM2: 1.94,
    noctC: 43,
    areaPerKwpLabel: '~5 m²',
    priceTier: '●●●',
    pricePerWpEgp: 39,
    bestFitEn: 'Space-limited roofs & extreme heat regions (Western Desert, Upper Egypt)',
    bestFitAr: 'الأسطح المحدودة والمناطق شديدة الحرارة (الصعيد والواحات)',
    calloutsEn: [
      'a-Si:H passivated monocrystalline wafer · 20.6% eff.',
      'Industry-best heat resilience γ = −0.26%/°C',
      '9-busbar half-cut cell architecture · 400 Wp',
    ],
    calloutsAr: [
      'رقائق أحادية مغلفة بسيليكون غير متبلور · كفاءة 20.6%',
      'أقل فقد حراري في الصيف γ = −0.26%/°م',
      'تصميم 9 قضبان توصيل دقيقة · 400 واط',
    ],
  },
  CIGS: {
    key: 'CIGS',
    shortKey: 'cigs',
    nameEn: 'CIGS Thin-Film',
    nameAr: 'أغشية رقيقة (CIGS)',
    subtitleEn: 'Copper Indium Gallium Selenide · Diffuse & coastal specialist',
    subtitleAr: 'أداء متميز في الإضاءة المنتشرة والضباب الساحلي',
    efficiencyRange: '12–16 %',
    efficiencyNominalPct: 14.2,
    tempCoeffRange: '−0.31 to −0.36 %/°C',
    tempCoeffPctPerC: -0.33,
    degradationPctPerYear: 0.5,
    panelWp: 175,
    panelAreaM2: 1.23,
    noctC: 46,
    areaPerKwpLabel: '~7–8 m²',
    priceTier: '●●○',
    pricePerWpEgp: 33,
    bestFitEn: 'Coastal haze, diffuse skies, lightweight roofs & East/West tilts',
    bestFitAr: 'المناطق الساحلية والضباب الخفيف والأسطح خفيفة الوزن',
    calloutsEn: [
      'Monolithic laser-scribed thin film · broad spectrum',
      'Moderate thermal loss γ = −0.33%/°C · low-light gain',
      'Sleek frameless-look black module · 175 Wp (1.23 m²)',
    ],
    calloutsAr: [
      'طبقة رقيقة متجانسة محفورة بالليزر · طيف واسع',
      'تحمل حراري جيد −0.33%/°م واستجابة للضوء الخافت',
      'تصميم أسود انسيابي خفيف الوزن · 175 واط (1.23 م²)',
    ],
  },
};

export const PANEL_TECH_LIST: PanelTechnologyInfo[] = [
  PANEL_TECHNOLOGIES['pc-Si'],
  PANEL_TECHNOLOGIES['a-Si:H/sc-Si'],
  PANEL_TECHNOLOGIES['CIGS'],
];

export function normalizePanelTech(raw?: string | null): PanelTech {
  if (!raw) return 'pc-Si';
  const lower = raw.toLowerCase();
  if (lower === 'hjt' || lower === 'a-si:h/sc-si' || lower.includes('si:h')) {
    return 'a-Si:H/sc-Si';
  }
  if (lower === 'cigs') return 'CIGS';
  return 'pc-Si';
}

export function techToShortKey(tech: PanelTech): 'pc' | 'hjt' | 'cigs' {
  return PANEL_TECHNOLOGIES[tech].shortKey;
}
