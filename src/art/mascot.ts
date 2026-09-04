import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';
import { buildPalette, type FormPalette, type Palette } from './palette';

/** SVG の座標系。100×100 のなかで完結させる。 */
export const VIEW_SIZE = 100;

export type MascotShape =
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      opacity?: number;
      stroked?: boolean;
      rotate?: number;
    }
  | { kind: 'path'; d: string; fill: string; opacity?: number; stroked?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number; stroked?: boolean }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; opacity?: number }
  | { kind: 'ring'; cx: number; cy: number; r: number; stroke: string; width: number; opacity?: number }
  | { kind: 'gradient-def'; id: string; from: string; to: string; x1: number; y1: number; x2: number; y2: number };

export type MascotArtwork = {
  viewBox: string;
  outlineColor: string;
  outlineWidth: number;
  shapes: MascotShape[];
  bodyGradientId: string;
};

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, ratio));
}

/**
 * 頂点の並びから、なめらかに閉じた輪郭パスをつくる道具。頭と胴を同じ土台に
 * 固定するためのものではなく、1つの塊（頭だけ、胴だけ、翼だけ）を
 * 種族らしい凹凸のある輪郭で描くための共通の作図法として使う。
 */
function smoothClosedPath(points: Array<[number, number]>): string {
  const count = points.length;
  const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const startMid = midpoint(points[count - 1], points[0]);
  const segments = [`M${startMid[0].toFixed(1)},${startMid[1].toFixed(1)}`];
  for (let index = 0; index < count; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % count];
    const mid = midpoint(point, next);
    segments.push(`Q${point[0].toFixed(1)},${point[1].toFixed(1)} ${mid[0].toFixed(1)},${mid[1].toFixed(1)}`);
  }
  return `${segments.join(' ')} Z`;
}

function silhouettePath(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  normalizedPoints: ReadonlyArray<readonly [number, number]>,
): string {
  return smoothClosedPath(normalizedPoints.map(([nx, ny]) => [centerX + nx * radiusX, centerY + ny * radiusY]));
}

function leafPath(originX: number, originY: number, dirX: number, length: number, width: number): string {
  const tipX = originX + dirX * length;
  const tipY = originY - length * 0.28;
  const c1x = originX + dirX * length * 0.32;
  const c1y = originY - width * 1.05;
  const c2x = originX + dirX * length * 0.78;
  const c2y = tipY - width * 0.22;
  const c3x = originX + dirX * length * 0.7;
  const c3y = originY + width * 0.85;
  const c4x = originX + dirX * length * 0.18;
  const c4y = originY + width * 0.3;
  return (
    `M${originX.toFixed(1)},${originY.toFixed(1)} ` +
    `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} ` +
    `C${c3x.toFixed(1)},${c3y.toFixed(1)} ${c4x.toFixed(1)},${c4y.toFixed(1)} ${originX.toFixed(1)},${originY.toFixed(1)} Z`
  );
}

function starPath(cx: number, cy: number, size: number): string {
  const outer = size;
  const inner = size * 0.4;
  const points: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${points.join(' ')} Z`;
}

const CENTER_X = 50;

// ============================================================
// 姿（幼体・中間形態・最終形態）の型。頭と胴を同じ土台に載せない。
// 姿ごとに自分の頭の位置・大きさ・胴の位置・大きさ・脚の生やし方を
// すべて自分で持つ。幼体だけ頭でっかちのちびキャラでよく、
// 中間形態と最終形態は首・胴・脚を持つ本物の動物のつくりにする。
// ============================================================

type EyeShape = 'roundBig' | 'roundSmall' | 'almond' | 'slit' | 'simple';
type LegStyle = 'chibiStub' | 'standingPaws' | 'birdLegs';
type EarKind =
  | 'floppyPuppy' | 'perkedDog' | 'wolfPointed'
  | 'roundKitten' | 'catTufted' | 'lionRound'
  | 'roundCub' | 'raccoonPointed' | 'grizzlyRound'
  | 'none'
  | 'hawkTufts' | 'dragonHorn';
type TailKind =
  | 'wagPuppy' | 'furryDog' | 'wolfBrush'
  | 'catCurl' | 'lionTuft'
  | 'cubStub' | 'raccoonRings' | 'grizzlyStub'
  | 'none' | 'sparrowShort' | 'hawkFan' | 'phoenixPlumes' | 'dragonTail';
type MuzzleKind = 'puppySmall' | 'dogSnout' | 'wolfSnout' | 'catSmall' | 'lionSnout' | 'bearRound' | 'beakSmall' | 'beakHooked' | 'beakFlame' | 'dragonSnout';
type HeadExtraKind = 'none' | 'lionMane' | 'raccoonMask' | 'roosterComb' | 'phoenixCrest' | 'hawkBrow' | 'iceCrown';

type FormDefinition = {
  label: string;
  palette: FormPalette;
  scaleBase: number;
  headCenterY: number;
  headRadiusX: number;
  headRadiusY: number;
  headSilhouette: ReadonlyArray<readonly [number, number]>;
  snoutDepth: number;
  bodyCenterY: number;
  bodyRadiusX: number;
  bodyRadiusY: number;
  bodySilhouette: ReadonlyArray<readonly [number, number]>;
  legStyle: LegStyle;
  legSpread: number;
  legLength: number;
  ears: EarKind;
  tail: TailKind;
  muzzle: MuzzleKind;
  headExtra: HeadExtraKind;
  eyeShape: EyeShape;
  eyeTilt: number;
  eyeSpreadFactor: number;
  hasWhiskers: boolean;
  hasWings: boolean;
  /** おなか側に明るい色のパッチを重ねる（ペンギンの白い腹など） */
  hasBellyPatch?: boolean;
};

type FormTier = 'baby' | 'mid' | 'final';
type FormSet = Record<FormTier, FormDefinition>;

// ---------- いぬ系統：子犬 → 犬 → おおかみ ----------
const DOG_FORMS: FormSet = {
  baby: {
    label: '子犬',
    palette: { hue: 32, saturation: 46, lightness: 58, accessoryHue: 205, eyeHue: 26 },
    scaleBase: 1,
    headCenterY: 39, headRadiusX: 27, headRadiusY: 25,
    headSilhouette: [
      [0, -1], [0.7, -0.72], [1, -0.05], [0.78, 0.42],
      [0.55, 0.82], [0.22, 1.22], [-0.22, 1.22], [-0.55, 0.82],
      [-0.78, 0.42], [-1, -0.05], [-0.7, -0.72],
    ],
    snoutDepth: 1.14,
    bodyCenterY: 75, bodyRadiusX: 19, bodyRadiusY: 18,
    bodySilhouette: [
      [0, -1], [0.75, -0.8], [0.95, -0.2], [0.85, 0.4],
      [0.55, 0.95], [0, 1.08], [-0.55, 0.95],
      [-0.85, 0.4], [-0.95, -0.2], [-0.75, -0.8],
    ],
    legStyle: 'chibiStub', legSpread: 0.55, legLength: 6,
    ears: 'floppyPuppy', tail: 'wagPuppy', muzzle: 'puppySmall', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.95,
    hasWhiskers: false, hasWings: false,
  },
  mid: {
    label: 'いぬ',
    palette: { hue: 30, saturation: 55, lightness: 52, accessoryHue: 205, eyeHue: 26 },
    scaleBase: 1,
    headCenterY: 27, headRadiusX: 18, headRadiusY: 17,
    headSilhouette: [
      [0, -1], [0.68, -0.7], [0.98, -0.05], [0.8, 0.4],
      [0.56, 0.78], [0.24, 1.2], [-0.24, 1.2], [-0.56, 0.78],
      [-0.8, 0.4], [-0.98, -0.05], [-0.68, -0.7],
    ],
    snoutDepth: 1.12,
    bodyCenterY: 58, bodyRadiusX: 17, bodyRadiusY: 20,
    bodySilhouette: [
      [0, -1], [0.72, -0.85], [0.98, -0.3], [0.9, 0.35],
      [0.62, 0.85], [0, 1], [-0.62, 0.85],
      [-0.9, 0.35], [-0.98, -0.3], [-0.72, -0.85],
    ],
    legStyle: 'standingPaws', legSpread: 0.62, legLength: 20,
    ears: 'perkedDog', tail: 'furryDog', muzzle: 'dogSnout', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.92,
    hasWhiskers: false, hasWings: false,
  },
  final: {
    label: 'おおかみ',
    palette: { hue: 220, saturation: 12, lightness: 58, accessoryHue: 205, eyeHue: 48 },
    scaleBase: 1.08,
    headCenterY: 24, headRadiusX: 17, headRadiusY: 16,
    headSilhouette: [
      [0, -1], [0.62, -0.72], [0.9, -0.1], [0.72, 0.36],
      [0.5, 0.7], [0.2, 1.35], [-0.2, 1.35], [-0.5, 0.7],
      [-0.72, 0.36], [-0.9, -0.1], [-0.62, -0.72],
    ],
    snoutDepth: 1.28,
    bodyCenterY: 56, bodyRadiusX: 18, bodyRadiusY: 23,
    bodySilhouette: [
      [0, -1], [0.7, -0.88], [1, -0.35], [0.94, 0.3],
      [0.6, 0.82], [0, 0.98], [-0.6, 0.82],
      [-0.94, 0.3], [-1, -0.35], [-0.7, -0.88],
    ],
    legStyle: 'standingPaws', legSpread: 0.68, legLength: 26,
    ears: 'wolfPointed', tail: 'wolfBrush', muzzle: 'wolfSnout', headExtra: 'none',
    eyeShape: 'almond', eyeTilt: 9, eyeSpreadFactor: 1,
    hasWhiskers: false, hasWings: false,
  },
};

// 幼体はどの系統も「頭でっかちのまんまるちびキャラ」でよいので、
// 輪郭点そのものは使い回してよい。可愛さは色・耳・尾・マズルで出す。
const CHIBI_HEAD_POINTS = DOG_FORMS.baby.headSilhouette;
const CHIBI_BODY_POINTS = DOG_FORMS.baby.bodySilhouette;
// 中間形態・最終形態（哺乳類）は首があり胴が縦長になる、本物の動物の土台
const MAMMAL_HEAD_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0.66, -0.7], [0.96, -0.06], [0.78, 0.4],
  [0.54, 0.76], [0.22, 1.22], [-0.22, 1.22], [-0.54, 0.76],
  [-0.78, 0.4], [-0.96, -0.06], [-0.66, -0.7],
];
const MAMMAL_BODY_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0.72, -0.85], [0.98, -0.28], [0.9, 0.32],
  [0.6, 0.84], [0, 1], [-0.6, 0.84],
  [-0.9, 0.32], [-0.98, -0.28], [-0.72, -0.85],
];
// 鳥は首が短く、胸が前に出た卵形の胴になる
const BIRD_HEAD_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0.74, -0.68], [1, -0.02], [0.8, 0.46],
  [0.5, 0.9], [0, 1.1], [-0.5, 0.9],
  [-0.8, 0.46], [-1, -0.02], [-0.74, -0.68],
];
const BIRD_BODY_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1.05], [0.62, -0.7], [0.92, 0.05], [0.78, 0.6],
  [0.4, 1], [0, 1.1], [-0.4, 1],
  [-0.78, 0.6], [-0.92, 0.05], [-0.62, -0.7],
];

// ---------- ねこ系統：子猫 → ねこ → ライオン ----------
const CAT_FORMS: FormSet = {
  baby: {
    label: '子猫',
    palette: { hue: 35, saturation: 55, lightness: 62, accessoryHue: 330, eyeHue: 120 },
    scaleBase: 1,
    headCenterY: 39, headRadiusX: 26, headRadiusY: 25, headSilhouette: CHIBI_HEAD_POINTS,
    snoutDepth: 1.1,
    bodyCenterY: 76, bodyRadiusX: 18, bodyRadiusY: 17, bodySilhouette: CHIBI_BODY_POINTS,
    legStyle: 'chibiStub', legSpread: 0.55, legLength: 6,
    ears: 'roundKitten', tail: 'catCurl', muzzle: 'catSmall', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.9,
    hasWhiskers: true, hasWings: false,
  },
  mid: {
    label: 'ねこ',
    palette: { hue: 32, saturation: 60, lightness: 56, accessoryHue: 330, eyeHue: 120 },
    scaleBase: 0.98,
    headCenterY: 28, headRadiusX: 17, headRadiusY: 16, headSilhouette: MAMMAL_HEAD_POINTS,
    snoutDepth: 1.08,
    bodyCenterY: 60, bodyRadiusX: 15, bodyRadiusY: 19, bodySilhouette: MAMMAL_BODY_POINTS,
    legStyle: 'standingPaws', legSpread: 0.56, legLength: 18,
    ears: 'catTufted', tail: 'catCurl', muzzle: 'catSmall', headExtra: 'none',
    eyeShape: 'almond', eyeTilt: 4, eyeSpreadFactor: 0.95,
    hasWhiskers: true, hasWings: false,
  },
  final: {
    label: 'ライオン',
    palette: { hue: 40, saturation: 58, lightness: 54, accessoryHue: 40, eyeHue: 45 },
    scaleBase: 1.1,
    headCenterY: 26, headRadiusX: 18, headRadiusY: 17, headSilhouette: MAMMAL_HEAD_POINTS,
    snoutDepth: 1.1,
    bodyCenterY: 58, bodyRadiusX: 18, bodyRadiusY: 22, bodySilhouette: MAMMAL_BODY_POINTS,
    legStyle: 'standingPaws', legSpread: 0.62, legLength: 24,
    ears: 'lionRound', tail: 'lionTuft', muzzle: 'lionSnout', headExtra: 'lionMane',
    eyeShape: 'almond', eyeTilt: 6, eyeSpreadFactor: 1,
    hasWhiskers: true, hasWings: false,
  },
};

// ---------- くま系統：こぐま → あらいぐま → グリズリー ----------
const BEAR_FORMS: FormSet = {
  baby: {
    label: 'こぐま',
    palette: { hue: 26, saturation: 38, lightness: 45, accessoryHue: 170, eyeHue: 20 },
    scaleBase: 1.02,
    headCenterY: 39, headRadiusX: 27, headRadiusY: 25, headSilhouette: CHIBI_HEAD_POINTS,
    snoutDepth: 1.08,
    bodyCenterY: 76, bodyRadiusX: 20, bodyRadiusY: 18, bodySilhouette: CHIBI_BODY_POINTS,
    legStyle: 'chibiStub', legSpread: 0.58, legLength: 6,
    ears: 'roundCub', tail: 'cubStub', muzzle: 'bearRound', headExtra: 'none',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.88,
    hasWhiskers: false, hasWings: false,
  },
  mid: {
    label: 'あらいぐま',
    palette: { hue: 220, saturation: 8, lightness: 52, accessoryHue: 170, eyeHue: 20 },
    scaleBase: 0.95,
    headCenterY: 28, headRadiusX: 17, headRadiusY: 16, headSilhouette: MAMMAL_HEAD_POINTS,
    snoutDepth: 1.06,
    bodyCenterY: 59, bodyRadiusX: 15, bodyRadiusY: 18, bodySilhouette: MAMMAL_BODY_POINTS,
    legStyle: 'standingPaws', legSpread: 0.5, legLength: 13,
    ears: 'raccoonPointed', tail: 'raccoonRings', muzzle: 'bearRound', headExtra: 'raccoonMask',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.9,
    hasWhiskers: false, hasWings: false,
  },
  final: {
    label: 'グリズリー',
    palette: { hue: 22, saturation: 35, lightness: 34, accessoryHue: 170, eyeHue: 30 },
    scaleBase: 1.2,
    headCenterY: 25, headRadiusX: 19, headRadiusY: 18, headSilhouette: MAMMAL_HEAD_POINTS,
    snoutDepth: 1.14,
    bodyCenterY: 58, bodyRadiusX: 21, bodyRadiusY: 23, bodySilhouette: MAMMAL_BODY_POINTS,
    legStyle: 'standingPaws', legSpread: 0.7, legLength: 22,
    ears: 'grizzlyRound', tail: 'grizzlyStub', muzzle: 'bearRound', headExtra: 'none',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.92,
    hasWhiskers: false, hasWings: false,
  },
};

// ---------- ひよこ系統：ひよこ → にわとり → フェニックス ----------
const CHICK_FORMS: FormSet = {
  baby: {
    label: 'ひよこ',
    palette: { hue: 50, saturation: 70, lightness: 68, accessoryHue: 45, eyeHue: 20 },
    scaleBase: 0.94,
    headCenterY: 41, headRadiusX: 25, headRadiusY: 24, headSilhouette: CHIBI_HEAD_POINTS,
    snoutDepth: 0.95,
    bodyCenterY: 77, bodyRadiusX: 20, bodyRadiusY: 19, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6, legLength: 6,
    ears: 'none', tail: 'sparrowShort', muzzle: 'beakSmall', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.85,
    hasWhiskers: false, hasWings: true,
  },
  mid: {
    label: 'にわとり',
    palette: { hue: 20, saturation: 35, lightness: 60, accessoryHue: 10, eyeHue: 15 },
    scaleBase: 0.96,
    headCenterY: 27, headRadiusX: 16, headRadiusY: 15, headSilhouette: BIRD_HEAD_POINTS,
    snoutDepth: 0.9,
    bodyCenterY: 60, bodyRadiusX: 16, bodyRadiusY: 20, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6, legLength: 16,
    ears: 'none', tail: 'hawkFan', muzzle: 'beakSmall', headExtra: 'roosterComb',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.88,
    hasWhiskers: false, hasWings: true,
  },
  final: {
    label: 'フェニックス',
    palette: { hue: 14, saturation: 82, lightness: 52, accessoryHue: 20, eyeHue: 15 },
    scaleBase: 1.12,
    headCenterY: 25, headRadiusX: 16, headRadiusY: 15, headSilhouette: BIRD_HEAD_POINTS,
    snoutDepth: 0.95,
    bodyCenterY: 58, bodyRadiusX: 16, bodyRadiusY: 22, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6, legLength: 20,
    ears: 'none', tail: 'phoenixPlumes', muzzle: 'beakFlame', headExtra: 'phoenixCrest',
    eyeShape: 'almond', eyeTilt: 5, eyeSpreadFactor: 0.95,
    hasWhiskers: false, hasWings: true,
  },
};

// ---------- すずめ系統：すずめ → たか → ドラゴン ----------
const SPARROW_FORMS: FormSet = {
  baby: {
    label: 'すずめ',
    palette: { hue: 32, saturation: 30, lightness: 52, accessoryHue: 200, eyeHue: 25 },
    scaleBase: 0.9,
    headCenterY: 41, headRadiusX: 24, headRadiusY: 23, headSilhouette: CHIBI_HEAD_POINTS,
    snoutDepth: 0.95,
    bodyCenterY: 77, bodyRadiusX: 18, bodyRadiusY: 17, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 5.4, legLength: 5,
    ears: 'none', tail: 'sparrowShort', muzzle: 'beakSmall', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.85,
    hasWhiskers: false, hasWings: true,
  },
  mid: {
    label: 'たか',
    palette: { hue: 28, saturation: 32, lightness: 40, accessoryHue: 200, eyeHue: 40 },
    scaleBase: 0.98,
    headCenterY: 27, headRadiusX: 15, headRadiusY: 14, headSilhouette: BIRD_HEAD_POINTS,
    snoutDepth: 0.95,
    bodyCenterY: 59, bodyRadiusX: 15, bodyRadiusY: 19, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 5.6, legLength: 15,
    ears: 'hawkTufts', tail: 'hawkFan', muzzle: 'beakHooked', headExtra: 'hawkBrow',
    eyeShape: 'slit', eyeTilt: 10, eyeSpreadFactor: 0.95,
    hasWhiskers: false, hasWings: true,
  },
  final: {
    label: 'ドラゴン',
    palette: { hue: 255, saturation: 45, lightness: 36, accessoryHue: 280, eyeHue: 70 },
    scaleBase: 1.16,
    headCenterY: 24, headRadiusX: 18, headRadiusY: 17, headSilhouette: MAMMAL_HEAD_POINTS,
    snoutDepth: 1.3,
    bodyCenterY: 57, bodyRadiusX: 18, bodyRadiusY: 23, bodySilhouette: MAMMAL_BODY_POINTS,
    legStyle: 'standingPaws', legSpread: 0.66, legLength: 24,
    ears: 'dragonHorn', tail: 'dragonTail', muzzle: 'dragonSnout', headExtra: 'none',
    eyeShape: 'slit', eyeTilt: 12, eyeSpreadFactor: 1,
    hasWhiskers: false, hasWings: true,
  },
};

// ---------- ペンギン系統：ひな → ペンギン → ひょうていおう ----------
const PENGUIN_FORMS: FormSet = {
  baby: {
    label: 'ひな',
    palette: { hue: 30, saturation: 14, lightness: 58, accessoryHue: 35, eyeHue: 20 },
    scaleBase: 0.96,
    headCenterY: 40, headRadiusX: 26, headRadiusY: 25, headSilhouette: CHIBI_HEAD_POINTS,
    snoutDepth: 0.92,
    bodyCenterY: 77, bodyRadiusX: 19, bodyRadiusY: 18, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6, legLength: 5,
    ears: 'none', tail: 'none', muzzle: 'beakSmall', headExtra: 'none',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.85,
    hasWhiskers: false, hasWings: true, hasBellyPatch: false,
  },
  mid: {
    label: 'ペンギン',
    palette: { hue: 216, saturation: 30, lightness: 20, accessoryHue: 38, eyeHue: 20 },
    scaleBase: 1,
    headCenterY: 27, headRadiusX: 16, headRadiusY: 15, headSilhouette: BIRD_HEAD_POINTS,
    snoutDepth: 0.85,
    bodyCenterY: 59, bodyRadiusX: 16, bodyRadiusY: 21, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6.4, legLength: 12,
    ears: 'none', tail: 'sparrowShort', muzzle: 'beakSmall', headExtra: 'none',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.86,
    hasWhiskers: false, hasWings: true, hasBellyPatch: true,
  },
  final: {
    label: 'ひょうていおう',
    palette: { hue: 205, saturation: 42, lightness: 30, accessoryHue: 195, eyeHue: 195 },
    scaleBase: 1.14,
    headCenterY: 25, headRadiusX: 16, headRadiusY: 15, headSilhouette: BIRD_HEAD_POINTS,
    snoutDepth: 0.9,
    bodyCenterY: 57, bodyRadiusX: 17, bodyRadiusY: 24, bodySilhouette: BIRD_BODY_POINTS,
    legStyle: 'birdLegs', legSpread: 6.6, legLength: 16,
    ears: 'none', tail: 'hawkFan', muzzle: 'beakHooked', headExtra: 'iceCrown',
    eyeShape: 'almond', eyeTilt: 6, eyeSpreadFactor: 0.92,
    hasWhiskers: false, hasWings: true, hasBellyPatch: true,
  },
};

const FORM_SETS: Record<CharacterSpecies, FormSet> = {
  dog: DOG_FORMS,
  cat: CAT_FORMS,
  bear: BEAR_FORMS,
  chick: CHICK_FORMS,
  sparrow: SPARROW_FORMS,
  penguin: PENGUIN_FORMS,
};

export const GROWTH_STAGE_NAMES = [
  'よれよれ',
  'ぼさぼさ',
  'すこし整った',
  '毛づやが出た',
  '目に光が戻った',
  'きれいになってきた',
  '見違えた',
  '自慢の姿',
  'オーラをまとった',
  'でんせつのすがた',
];

/** 成長段階からどの姿（幼体・中間・最終）を見せるか。 */
function tierForStage(growthStage: number): FormTier {
  if (growthStage <= 3) return 'baby';
  if (growthStage <= 7) return 'mid';
  return 'final';
}

/**
 * 同じ姿（幼体・中間・最終）の中でも、3〜4段階かけて少しずつ育っていく
 * 進み具合（0〜1）。姿の種類（耳・尾・マズルの種類）は姿の境目でしか
 * 切り替わらないが、頭身や脚の長さはこの値でなめらかに変えることで、
 * 9段階それぞれが見た目の違う1枚絵になるようにする。
 */
function tierLocalProgress(growthStage: number): number {
  if (growthStage <= 3) return growthStage / 3;
  if (growthStage <= 7) return (growthStage - 4) / 3;
  return growthStage - 8;
}

type EyeStyle = 'droopy' | 'round' | 'sparkle' | 'hero';
type MouthStyle = 'sad' | 'smile' | 'grin';
type AccessoryStyle = 'none' | 'collar' | 'ribbon' | 'crown' | 'crownGem';
type AuraStyle = 'none' | 'sparkle' | 'burstSmall' | 'burstBig';

type StageLook = {
  scale: number;
  coatMix: number;
  eyes: EyeStyle;
  mouth: MouthStyle;
  blush: boolean;
  accessory: AccessoryStyle;
  aura: AuraStyle;
};

/**
 * 姿の中でどれだけ育っているか（毛づやの良さ・表情・かざり）の進み方。
 * 姿が切り替わる境目（4段階目・8段階目）では、変身直後らしく少しだけ
 * くすんだ状態から始まり、その姿の中でまた磨かれていく。
 */
const STAGE_LOOKS: StageLook[] = [
  { scale: 0.86, coatMix: 0.0, eyes: 'droopy', mouth: 'sad', blush: false, accessory: 'none', aura: 'none' },
  { scale: 0.92, coatMix: 0.35, eyes: 'droopy', mouth: 'sad', blush: false, accessory: 'none', aura: 'none' },
  { scale: 0.97, coatMix: 0.7, eyes: 'round', mouth: 'smile', blush: true, accessory: 'collar', aura: 'none' },
  { scale: 1.0, coatMix: 1.0, eyes: 'round', mouth: 'smile', blush: true, accessory: 'collar', aura: 'none' },
  { scale: 0.94, coatMix: 0.15, eyes: 'round', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'none' },
  { scale: 0.98, coatMix: 0.5, eyes: 'sparkle', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'none' },
  { scale: 1.02, coatMix: 0.8, eyes: 'sparkle', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'sparkle' },
  { scale: 1.06, coatMix: 1.0, eyes: 'sparkle', mouth: 'grin', blush: true, accessory: 'crown', aura: 'sparkle' },
  { scale: 1.0, coatMix: 0.45, eyes: 'hero', mouth: 'grin', blush: false, accessory: 'crownGem', aura: 'burstSmall' },
  { scale: 1.08, coatMix: 1.0, eyes: 'hero', mouth: 'grin', blush: false, accessory: 'crownGem', aura: 'burstBig' },
];

export type MascotInput = {
  species: CharacterSpecies;
  /** 0（細い）〜1（太い） */
  shapeValue: number;
  /** 0〜9 */
  growthStage: number;
  condition: CharacterCondition;
  frame?: number;
};

export function buildMascotArtwork(input: MascotInput): MascotArtwork {
  const { species, condition } = input;
  const shapeValue = Math.min(1, Math.max(0, input.shapeValue));
  const growthStage = Math.min(9, Math.max(0, Math.round(input.growthStage)));
  const frame = input.frame === 1 ? 1 : 0;

  const tier = tierForStage(growthStage);
  const form = FORM_SETS[species][tier];
  const stageLook = STAGE_LOOKS[growthStage];
  const isExhausted = condition === 'exhausted';
  // その姿の中でどれだけ育ったか（0〜1）。頭身や脚の長さをこれで少しずつ
  // ずらし、同じ姿でも段階ごとに違う1枚絵になるようにする
  const drift = tierLocalProgress(growthStage);
  const headDrift = lerp(1.05, 0.97, drift);
  const legDrift = lerp(0.72, 1.08, drift);
  const snoutDrift = lerp(0.86, 1.1, drift);

  const palette = buildPalette({ form: form.palette, coatMix: stageLook.coatMix, condition });
  const shapes: MascotShape[] = [];

  // 体型が両極端なときは、太さだけでなく姿勢・表情にもはっきり出す
  const gauntFactor = Math.max(0, 0.5 - shapeValue) / 0.5; // 0(標準)〜1(かなり痩せ)
  const fatFactor = Math.max(0, shapeValue - 0.55) / 0.45; // 0(標準)〜1(かなり肥満)

  const droop = Math.min(1, (isExhausted ? 1 : condition === 'tired' ? 0.5 : 0) + gauntFactor * 0.7);
  const bounce = frame === 1 && !isExhausted ? -0.6 : 0;
  const scale = stageLook.scale * form.scaleBase;
  const outlineWidth = 1.6 + scale * 0.55;

  const bodyRadiusX = lerp(form.bodyRadiusX * 0.62, form.bodyRadiusX * 1.35, shapeValue) * scale;
  const bodyRadiusY = lerp(form.bodyRadiusY * 0.85, form.bodyRadiusY * 1.12, shapeValue) * scale;
  const bodyCenterY = form.bodyCenterY + bounce;

  const headRadiusX = form.headRadiusX * scale * lerp(0.94, 1.06, shapeValue * 0.4) * headDrift;
  const headRadiusY = form.headRadiusY * scale * headDrift;
  // やせているとうなだれ気味に、太っていると首が埋もれて頭がわずかに沈む
  const headCenterY = form.headCenterY + bounce + droop * 1.3 + gauntFactor * 2 * scale + fatFactor * 1.1 * scale;

  const effectiveEyes: EyeStyle | 'x' = isExhausted ? 'x' : stageLook.eyes;
  const effectiveMouth: MouthStyle = isExhausted ? 'sad' : stageLook.mouth;
  const effectiveAura: AuraStyle = isExhausted ? 'none' : stageLook.aura;
  const effectiveBlush = stageLook.blush && !isExhausted;

  const bodyGradientId = `mg-${palette.base.slice(1)}-${palette.light.slice(1)}`;
  shapes.push({
    kind: 'gradient-def', id: bodyGradientId, from: palette.light, to: palette.base,
    x1: 30, y1: 10, x2: 70, y2: 95,
  });

  if (effectiveAura !== 'none') {
    pushAura(shapes, palette, effectiveAura, CENTER_X, bodyCenterY - form.bodyRadiusY * 0.3, frame);
  }

  if (form.hasWings) {
    pushWings(shapes, palette, CENTER_X, bodyCenterY, bodyRadiusX, scale, bounce, outlineWidth);
  }

  pushTail(shapes, palette, form.tail, CENTER_X + bodyRadiusX, bodyCenterY, bodyRadiusY, scale, frame);

  // ---- 脚 ----
  const bodyBottomY = bodyCenterY + bodyRadiusY * 0.92;
  if (form.legStyle === 'chibiStub') {
    const footRadius = lerp(4.2, 7, shapeValue) * scale * lerp(0.55, 1.05, drift);
    const footColor = palette.shade;
    shapes.push(
      { kind: 'ellipse', cx: CENTER_X - bodyRadiusX * 0.5, cy: bodyBottomY, rx: footRadius, ry: footRadius * 0.72, fill: footColor, stroked: true },
      { kind: 'ellipse', cx: CENTER_X + bodyRadiusX * 0.5, cy: bodyBottomY, rx: footRadius, ry: footRadius * 0.72, fill: footColor, stroked: true },
    );
  } else if (form.legStyle === 'standingPaws') {
    pushStandingLegs(shapes, palette, CENTER_X, bodyBottomY, bodyRadiusX, form.legSpread * lerp(1, 1.2, fatFactor), form.legLength * scale * legDrift, scale);
  } else if (form.legStyle === 'birdLegs') {
    pushBirdLegs(shapes, palette, CENTER_X, bodyBottomY, bodyRadiusX * lerp(0.4, 0.5, fatFactor), form.legLength * scale * legDrift, scale);
  }

  // ---- 胴 ----
  shapes.push({
    kind: 'path',
    d: silhouettePath(CENTER_X, bodyCenterY, bodyRadiusX, bodyRadiusY, form.bodySilhouette),
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

  if (form.hasBellyPatch) {
    shapes.push({
      kind: 'ellipse', cx: CENTER_X, cy: bodyCenterY + bodyRadiusY * 0.1,
      rx: bodyRadiusX * 0.58, ry: bodyRadiusY * 0.72, fill: '#f5f3ec',
      opacity: 0.55 + stageLook.coatMix * 0.4,
    });
  }

  if (gauntFactor > 0.35) {
    // 肋骨が浮いて見えるくらい痩せている、という表現
    const ribOpacity = Math.min(0.6, (gauntFactor - 0.35) * 0.9);
    for (const offset of [-6, -2, 2, 6]) {
      shapes.push({
        kind: 'ellipse', cx: CENTER_X, cy: bodyCenterY + offset * scale,
        rx: bodyRadiusX * 0.56, ry: 1 * scale, fill: palette.deepShade, opacity: ribOpacity,
      });
    }
  }

  if (fatFactor > 0.3) {
    // ぽっちゃりした頬とあご
    const cheekOpacity = Math.min(0.9, fatFactor);
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse', cx: CENTER_X + direction * headRadiusX * 0.86, cy: headCenterY + headRadiusY * 0.28,
        rx: headRadiusX * 0.26 * fatFactor, ry: headRadiusY * 0.22 * fatFactor, fill: palette.base, opacity: cheekOpacity, stroked: true,
      });
    }
    shapes.push({
      kind: 'ellipse', cx: CENTER_X, cy: headCenterY + headRadiusY * 0.86, rx: headRadiusX * 0.34 * fatFactor,
      ry: headRadiusY * 0.16 * fatFactor, fill: palette.shade, opacity: cheekOpacity * 0.8,
    });
  }

  // ---- 首（頭の下端と胴の上端のすき間だけを埋める。マズルとは高さを分ける） ----
  const headBottomY = headCenterY + headRadiusY * 0.58;
  const bodyTopY = bodyCenterY - bodyRadiusY * 0.82;
  if (bodyTopY - headBottomY > -headRadiusY * 0.1) {
    const neckTop = headBottomY - headRadiusY * 0.1;
    const neckBottom = Math.max(neckTop + headRadiusY * 0.22, bodyTopY + bodyRadiusY * 0.14);
    shapes.push({
      kind: 'ellipse',
      cx: CENTER_X,
      cy: (neckTop + neckBottom) / 2,
      rx: headRadiusX * 0.4,
      ry: Math.max(2, (neckBottom - neckTop) / 2),
      fill: palette.shade,
    });
  }

  // ---- 耳（頭より奥） ----
  pushEars(shapes, palette, form.ears, CENTER_X, headRadiusX, headCenterY, headRadiusY, droop, scale, outlineWidth);

  // ---- 頭 ----
  shapes.push({
    kind: 'path',
    d: silhouettePath(CENTER_X, headCenterY, headRadiusX, headRadiusY, form.headSilhouette),
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

  pushHeadExtra(shapes, palette, form.headExtra, CENTER_X, headCenterY, headRadiusX, headRadiusY, scale);

  shapes.push({
    kind: 'ellipse',
    cx: CENTER_X - headRadiusX * 0.4, cy: headCenterY - headRadiusY * 0.5,
    rx: headRadiusX * 0.3, ry: headRadiusY * 0.18, fill: '#ffffff', opacity: 0.5, rotate: -20,
  });

  const eyeSpread = headRadiusX * 0.44 * form.eyeSpreadFactor;
  const eyeY = headCenterY - headRadiusY * 0.02;
  if (effectiveEyes === 'x') {
    pushExhaustedEyes(shapes, palette, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale);
  } else {
    pushEyes(shapes, palette, effectiveEyes, form.eyeShape, form.eyeTilt, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale);
  }

  if (gauntFactor > 0.3) {
    // 目の下にくま。栄養不足で疲れて見える
    const shadowOpacity = Math.min(0.55, (gauntFactor - 0.3) * 0.8);
    for (const eyeX of [CENTER_X - eyeSpread, CENTER_X + eyeSpread]) {
      shapes.push({
        kind: 'ellipse', cx: eyeX, cy: eyeY + headRadiusY * 0.32, rx: headRadiusX * 0.16, ry: headRadiusY * 0.08,
        fill: palette.deepShade, opacity: shadowOpacity,
      });
    }
  }

  const muzzleY = headCenterY + headRadiusY * (form.snoutDepth * snoutDrift * 0.6);
  pushMuzzle(shapes, palette, form.muzzle, form.hasWhiskers, CENTER_X, muzzleY, scale);
  pushMouth(shapes, palette, effectiveMouth, form.muzzle, CENTER_X, muzzleY + 5 * scale, scale);

  pushNeckwear(shapes, palette, stageLook.accessory, CENTER_X, headCenterY + headRadiusY * 1.02, headRadiusX, scale);

  if (effectiveBlush) {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse', cx: CENTER_X + direction * headRadiusX * 0.64, cy: headCenterY + headRadiusY * 0.32,
        rx: headRadiusX * 0.16, ry: headRadiusY * 0.11, fill: palette.blush, opacity: 0.85,
      });
    }
  }

  const crownBaseY = headCenterY - headRadiusY - 6 * scale + droop * 2;
  pushCrown(shapes, palette, stageLook.accessory, CENTER_X, crownBaseY, scale);

  if (isExhausted) {
    shapes.push({
      kind: 'path',
      d: `M${(CENTER_X + headRadiusX + 2).toFixed(1)},${(headCenterY - headRadiusY * 0.3).toFixed(1)} q3,4 0,8 q-3,-2 0,-8 Z`,
      fill: '#8ec9e8', opacity: 0.9,
    });
  }

  return { viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`, outlineColor: palette.outline, outlineWidth, shapes, bodyGradientId };
}

// ============================================================
// パーツの描画
// ============================================================

/** 画面下端(100)からはみ出さないよう、体の下端からの実際の余白に脚の長さを収める */
function clampLegReach(bodyBottomY: number, legLength: number, footMargin: number): number {
  const maxReach = Math.max(6, VIEW_SIZE - 3 - footMargin - bodyBottomY);
  return Math.min(legLength, maxReach);
}

function pushStandingLegs(
  shapes: MascotShape[], palette: Palette, centerX: number, bodyBottomY: number,
  bodyRadiusX: number, spread: number, legLength: number, scale: number,
): void {
  const pawRadius = 3.2 * scale;
  const reach = clampLegReach(bodyBottomY, legLength, pawRadius);
  // うしろ脚（奥）を先に描き、まえ脚を手前に重ねて奥行きを出す
  for (const direction of [-1, 1]) {
    const x = centerX + direction * bodyRadiusX * (spread + 0.16);
    shapes.push({ kind: 'ellipse', cx: x, cy: bodyBottomY + reach * 0.35, rx: 3.4 * scale, ry: reach * 0.42, fill: palette.shade, stroked: true });
    shapes.push({ kind: 'ellipse', cx: x, cy: bodyBottomY + reach * 0.62, rx: pawRadius * 0.95, ry: pawRadius * 0.7, fill: palette.deepShade, stroked: true });
  }
  for (const direction of [-1, 1]) {
    const x = centerX + direction * bodyRadiusX * spread * 0.55;
    shapes.push({ kind: 'ellipse', cx: x, cy: bodyBottomY + reach * 0.5, rx: 3.8 * scale, ry: reach * 0.55, fill: palette.base, stroked: true });
    shapes.push({ kind: 'ellipse', cx: x, cy: bodyBottomY + reach * 0.94, rx: pawRadius, ry: pawRadius * 0.75, fill: palette.light, stroked: true });
  }
}

function pushBirdLegs(
  shapes: MascotShape[], palette: Palette, centerX: number, bodyBottomY: number,
  spread: number, legLength: number, scale: number,
): void {
  const reach = clampLegReach(bodyBottomY, legLength, 3 * scale);
  for (const direction of [-1, 1]) {
    const x = centerX + direction * spread;
    shapes.push({ kind: 'line', x1: x, y1: bodyBottomY - 2 * scale, x2: x, y2: bodyBottomY + reach, stroke: palette.accessory, width: 2.2 * scale, opacity: 1 });
    for (const toe of [-1, 0, 1]) {
      shapes.push({
        kind: 'line', x1: x, y1: bodyBottomY + reach,
        x2: x + toe * 3 * scale, y2: bodyBottomY + reach + 3 * scale,
        stroke: palette.accessoryDark, width: 1.4 * scale,
      });
    }
  }
}

function pushEars(
  shapes: MascotShape[], palette: Palette, style: EarKind, headCenterX: number,
  headRadiusX: number, headCenterY: number, headRadiusY: number, droop: number, scale: number, outlineWidth: number,
): void {
  void outlineWidth;
  const headTop = headCenterY - headRadiusY;
  const leftX = headCenterX - headRadiusX * 0.6;
  const rightX = headCenterX + headRadiusX * 0.6;

  if (style === 'floppyPuppy' || style === 'perkedDog') {
    const isFloppy = style === 'floppyPuppy';
    const earTop = headTop + (isFloppy ? 8 : 3) * scale + droop * 3;
    for (const direction of [-1, 1]) {
      if (isFloppy) {
        shapes.push({ kind: 'ellipse', cx: headCenterX + direction * (headRadiusX + 1), cy: earTop + 12 * scale, rx: 7.4 * scale, ry: 14 * scale, fill: palette.shade, stroked: true, rotate: direction * 12 });
        shapes.push({ kind: 'ellipse', cx: headCenterX + direction * (headRadiusX + 1), cy: earTop + 12 * scale, rx: 3.6 * scale, ry: 9 * scale, fill: palette.deepShade, rotate: direction * 12 });
      } else {
        shapes.push({ kind: 'path', d: leafPath(headCenterX + direction * headRadiusX * 0.65, earTop, direction, 11 * scale, 5.4 * scale), fill: palette.base, stroked: true });
        shapes.push({ kind: 'path', d: leafPath(headCenterX + direction * headRadiusX * 0.65, earTop, direction, 7 * scale, 3 * scale), fill: palette.deepShade });
      }
    }
    return;
  }

  if (style === 'wolfPointed') {
    const apexY = headTop + 2 * scale + droop * 4;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: leafPath(x, apexY, dir, 14 * scale, 5.6 * scale), fill: palette.base, stroked: true });
      shapes.push({ kind: 'path', d: leafPath(x, apexY, dir, 8 * scale, 3 * scale), fill: palette.deepShade });
    }
    return;
  }

  if (style === 'roundKitten' || style === 'lionRound') {
    const r = style === 'roundKitten' ? 6.4 : 7.4;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: r * scale, fill: palette.base, stroked: true });
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: r * 0.44 * scale, fill: palette.nose });
    }
    return;
  }

  if (style === 'catTufted') {
    const apexY = headTop + 3 * scale;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: leafPath(x, apexY, dir, 10 * scale, 4.6 * scale), fill: palette.base, stroked: true });
      shapes.push({ kind: 'path', d: leafPath(x, apexY, dir, 6 * scale, 2.4 * scale), fill: palette.nose });
    }
    return;
  }

  if (style === 'roundCub' || style === 'grizzlyRound') {
    const r = style === 'roundCub' ? 7 : 8;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 4 * scale, r: r * scale, fill: palette.base, stroked: true });
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 4 * scale, r: r * 0.42 * scale, fill: palette.nose });
    }
    return;
  }

  if (style === 'raccoonPointed') {
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: leafPath(x, headTop + 3 * scale, dir, 9 * scale, 4.6 * scale), fill: palette.deepShade, stroked: true });
      shapes.push({ kind: 'path', d: leafPath(x, headTop + 3 * scale, dir, 5.4 * scale, 2.4 * scale), fill: palette.light });
    }
    return;
  }

  if (style === 'hawkTufts') {
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: leafPath(x, headTop + 1 * scale, dir, 5 * scale, 1.8 * scale), fill: palette.deepShade });
    }
    return;
  }

  if (style === 'dragonHorn') {
    const apexY = headTop + 3 * scale + droop * 3;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({
        kind: 'path',
        d: `M${(x - dir * 2.6 * scale).toFixed(1)},${(apexY + 6 * scale).toFixed(1)} ` +
          `Q${(x + dir * 1.5 * scale).toFixed(1)},${(apexY + 1 * scale).toFixed(1)} ${(x + dir * 5 * scale).toFixed(1)},${(apexY - 9 * scale).toFixed(1)} ` +
          `Q${(x + dir * 2 * scale).toFixed(1)},${(apexY + 2 * scale).toFixed(1)} ${(x + dir * 0.6 * scale).toFixed(1)},${(apexY + 7 * scale).toFixed(1)} Z`,
        fill: palette.accessory, stroked: true,
      });
    }
  }
}

function pushHeadExtra(
  shapes: MascotShape[], palette: Palette, kind: HeadExtraKind, centerX: number,
  headCenterY: number, headRadiusX: number, headRadiusY: number, scale: number,
): void {
  if (kind === 'none') return;

  if (kind === 'lionMane') {
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const x = centerX + Math.cos(angle) * headRadiusX * 0.98;
      const y = headCenterY + Math.sin(angle) * headRadiusY * 0.98;
      const dirX = Math.cos(angle) >= 0 ? 1 : -1;
      shapes.push({
        kind: 'ellipse', cx: x, cy: y, rx: 4.2 * scale, ry: 2.2 * scale,
        fill: i % 2 === 0 ? palette.shade : palette.deepShade, stroked: true,
        rotate: (angle * 180) / Math.PI + (dirX > 0 ? 0 : 180),
      });
    }
    return;
  }

  if (kind === 'raccoonMask') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse', cx: centerX + direction * headRadiusX * 0.4, cy: headCenterY - headRadiusY * 0.02,
        rx: headRadiusX * 0.32, ry: headRadiusY * 0.26, fill: palette.deepShade, opacity: 0.9,
      });
    }
    shapes.push({
      kind: 'ellipse', cx: centerX, cy: headCenterY - headRadiusY * 0.55, rx: headRadiusX * 0.5, ry: headRadiusY * 0.16,
      fill: palette.light, opacity: 0.9,
    });
    return;
  }

  if (kind === 'roosterComb') {
    for (let i = -1; i <= 1; i += 1) {
      shapes.push({
        kind: 'path',
        d: leafPath(centerX + i * 3.4 * scale, headCenterY - headRadiusY * 0.95, 1, 6 * scale, 2.4 * scale),
        fill: '#e6483f', stroked: true, opacity: 1,
      });
    }
    shapes.push({
      kind: 'path', d: leafPath(centerX, headCenterY + headRadiusY * 0.7, 1, 5 * scale, 2 * scale),
      fill: '#c73a32', stroked: true,
    });
    return;
  }

  if (kind === 'phoenixCrest') {
    for (const direction of [-1, 0, 1]) {
      shapes.push({
        kind: 'path',
        d: leafPath(centerX + direction * 4 * scale, headCenterY - headRadiusY * 0.9, direction === 0 ? -1 : direction, 10 * scale, 2.6 * scale),
        fill: palette.flame, stroked: true,
      });
    }
    return;
  }

  if (kind === 'hawkBrow') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse', cx: centerX + direction * headRadiusX * 0.42, cy: headCenterY - headRadiusY * 0.3,
        rx: headRadiusX * 0.22, ry: headRadiusY * 0.1, fill: palette.deepShade, rotate: direction * 15,
      });
    }
    return;
  }

  if (kind === 'iceCrown') {
    for (const direction of [-1.4, -0.6, 0.2, 1] as const) {
      shapes.push({
        kind: 'path',
        d: leafPath(centerX + direction * 4 * scale, headCenterY - headRadiusY * 0.92, direction < 0 ? -1 : 1, (9 - Math.abs(direction) * 2) * scale, 2.4 * scale),
        fill: palette.gem, stroked: true,
      });
    }
  }
}

function pushEyes(
  shapes: MascotShape[], palette: Palette, style: EyeStyle, eyeShape: EyeShape, tilt: number,
  leftEyeX: number, rightEyeX: number, eyeY: number, scale: number,
): void {
  if (style === 'droopy') {
    const half = 5.2 * scale;
    const bow = 2.6 * scale;
    for (const eyeX of [leftEyeX, rightEyeX]) {
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - half).toFixed(1)},${eyeY.toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY + bow).toFixed(1)} ${(eyeX + half).toFixed(1)},${eyeY.toFixed(1)}`,
        fill: 'none', stroked: true,
      });
    }
    return;
  }

  if (style === 'hero') {
    for (const eyeX of [leftEyeX, rightEyeX]) {
      const direction = eyeX < CENTER_X ? -1 : 1;
      shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx: 6 * scale, ry: 4.3 * scale, fill: palette.eye, stroked: true, rotate: -direction * 6 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 0.6, cy: eyeY + 0.6 * scale, rx: 2.3 * scale, ry: 2.6 * scale, fill: palette.eyeDark, rotate: -direction * 6 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 1.6, cy: eyeY - 1, rx: 1.3 * scale, ry: 1.8 * scale, fill: palette.eyeHighlight });
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - 6.2 * scale).toFixed(1)},${(eyeY - 3.4 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 6.4 * scale).toFixed(1)} ${(eyeX + 6.2 * scale).toFixed(1)},${(eyeY - direction * 1.6 * scale).toFixed(1)} L${(eyeX + 5.6 * scale).toFixed(1)},${(eyeY - direction * 0.2 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 4 * scale).toFixed(1)} ${(eyeX - 5.6 * scale).toFixed(1)},${(eyeY - 1.6 * scale).toFixed(1)} Z`,
        fill: palette.deepShade,
      });
    }
    return;
  }

  if (eyeShape === 'simple') {
    const radius = (style === 'sparkle' ? 4.6 : 4.1) * scale;
    for (const eyeX of [leftEyeX, rightEyeX]) {
      shapes.push({ kind: 'circle', cx: eyeX, cy: eyeY, r: radius, fill: palette.eyeDark });
      shapes.push({ kind: 'circle', cx: eyeX - radius * 0.32, cy: eyeY - radius * 0.34, r: radius * 0.34, fill: palette.eyeHighlight });
    }
    return;
  }

  const baseRadius = style === 'sparkle' ? 7.6 * scale : 6.6 * scale;
  const shapeRatio: Record<EyeShape, { rx: number; ry: number }> = {
    almond: { rx: 1.12, ry: 0.82 }, roundBig: { rx: 1.08, ry: 1.12 },
    roundSmall: { rx: 0.86, ry: 0.9 }, simple: { rx: 1, ry: 1 }, slit: { rx: 0.68, ry: 1.22 },
  };
  const ratio = shapeRatio[eyeShape];
  const rx = baseRadius * ratio.rx;
  const ry = baseRadius * ratio.ry;

  for (const eyeX of [leftEyeX, rightEyeX]) {
    const direction = eyeX < CENTER_X ? -1 : 1;
    const rotate = tilt * direction * -1;
    shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx, ry, fill: palette.eye, stroked: true, rotate });
    shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY + ry * 0.22, rx: rx * 0.4, ry: ry * 0.44, fill: palette.eyeDark, rotate });
    shapes.push({ kind: 'ellipse', cx: eyeX - rx * 0.3, cy: eyeY - ry * 0.34, rx: rx * 0.3, ry: ry * 0.36, fill: palette.eyeHighlight });
    if (style === 'sparkle') {
      shapes.push({ kind: 'ellipse', cx: eyeX + rx * 0.38, cy: eyeY + ry * 0.36, rx: rx * 0.14, ry: ry * 0.15, fill: palette.eyeHighlight, opacity: 0.9 });
    }
  }
}

function pushExhaustedEyes(shapes: MascotShape[], palette: Palette, leftEyeX: number, rightEyeX: number, eyeY: number, scale: number): void {
  const half = 5 * scale;
  for (const eyeX of [leftEyeX, rightEyeX]) {
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY - half, x2: eyeX + half, y2: eyeY + half, stroke: palette.outline, width: 2.2 * scale });
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY + half, x2: eyeX + half, y2: eyeY - half, stroke: palette.outline, width: 2.2 * scale });
  }
}

function pushMouth(shapes: MascotShape[], palette: Palette, style: MouthStyle, muzzle: MuzzleKind, centerX: number, mouthY: number, scale: number): void {
  if ((muzzle === 'beakSmall' || muzzle === 'beakHooked' || muzzle === 'beakFlame') && style !== 'grin') return;

  if (style === 'sad') {
    shapes.push({ kind: 'line', x1: centerX - 5.6 * scale, y1: mouthY + 2 * scale, x2: centerX, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
    shapes.push({ kind: 'line', x1: centerX + 5.6 * scale, y1: mouthY + 2 * scale, x2: centerX, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
    return;
  }

  if (style === 'grin') {
    shapes.push({
      kind: 'path',
      d: `M${(centerX - 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Q${centerX.toFixed(1)},${(mouthY + 9 * scale).toFixed(1)} ${(centerX + 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Q${centerX.toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} ${(centerX - 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Z`,
      fill: palette.deepShade, stroked: true,
    });
    shapes.push({
      kind: 'path',
      d: `M${(centerX - 2.6 * scale).toFixed(1)},${(mouthY + 0.4 * scale).toFixed(1)} L${(centerX + 2.6 * scale).toFixed(1)},${(mouthY + 0.4 * scale).toFixed(1)} L${(centerX + 1.6 * scale).toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} L${(centerX - 1.6 * scale).toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} Z`,
      fill: '#ffffff',
    });
    return;
  }

  shapes.push({ kind: 'line', x1: centerX - 5.6 * scale, y1: mouthY - 2 * scale, x2: centerX, y2: mouthY + 0.4 * scale, stroke: palette.outline, width: 2 * scale });
  shapes.push({ kind: 'line', x1: centerX, y1: mouthY + 0.4 * scale, x2: centerX + 5.6 * scale, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
}

function pushMuzzle(shapes: MascotShape[], palette: Palette, kind: MuzzleKind, hasWhiskers: boolean, centerX: number, muzzleY: number, scale: number): void {
  if (kind === 'beakSmall' || kind === 'beakHooked' || kind === 'beakFlame') {
    const top = muzzleY - 3.4 * scale;
    const bottom = muzzleY + (kind === 'beakHooked' ? 4.2 : 5.6) * scale;
    const wing = 5 * scale;
    const mid = muzzleY + 1.2 * scale;
    if (kind === 'beakHooked') {
      shapes.push({
        kind: 'path',
        d: `M${centerX.toFixed(1)},${top.toFixed(1)} Q${(centerX + wing * 1.3).toFixed(1)},${mid.toFixed(1)} ${(centerX + 1).toFixed(1)},${bottom.toFixed(1)} Q${(centerX - wing).toFixed(1)},${mid.toFixed(1)} ${centerX.toFixed(1)},${top.toFixed(1)} Z`,
        fill: palette.accessory, stroked: true,
      });
    } else {
      shapes.push({
        kind: 'path',
        d: `M${centerX.toFixed(1)},${top.toFixed(1)} L${(centerX + wing).toFixed(1)},${mid.toFixed(1)} L${centerX.toFixed(1)},${bottom.toFixed(1)} L${(centerX - wing).toFixed(1)},${mid.toFixed(1)} Z`,
        fill: palette.accessory, stroked: true,
      });
    }
    return;
  }

  if (kind === 'dogSnout' || kind === 'wolfSnout') {
    const isWolf = kind === 'wolfSnout';
    const rx = (isWolf ? 4.6 : 5.4) * scale;
    const ry = (isWolf ? 7.6 : 6.6) * scale;
    const tipY = muzzleY + ry * 0.7;
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + ry * 0.15, rx, ry, fill: palette.light, stroked: true });
    shapes.push({ kind: 'ellipse', cx: centerX, cy: tipY, rx: rx * 0.5, ry: ry * 0.32, fill: palette.eyeDark, stroked: true });
    return;
  }

  if (kind === 'bearRound') {
    const rx = 5.8 * scale;
    const ry = 6.2 * scale;
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + ry * 0.05, rx, ry, fill: palette.light, stroked: true });
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + ry * 0.62, rx: rx * 0.46, ry: ry * 0.32, fill: palette.eyeDark, stroked: true });
    return;
  }

  if (kind === 'lionSnout') {
    const rx = 5.6 * scale;
    const ry = 5.4 * scale;
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY, rx, ry, fill: palette.light, stroked: true });
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY - ry * 0.28, rx: rx * 0.4, ry: ry * 0.3, fill: palette.nose, stroked: true });
    return;
  }

  if (kind === 'dragonSnout') {
    const rx = 4.6 * scale;
    const ry = 6.8 * scale;
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + ry * 0.1, rx, ry, fill: palette.light, stroked: true });
    for (const direction of [-1, 1]) {
      shapes.push({ kind: 'ellipse', cx: centerX + direction * rx * 0.42, cy: muzzleY + ry * 0.5, rx: 0.9 * scale, ry: 1.5 * scale, fill: palette.eyeDark });
    }
    return;
  }

  // puppySmall / catSmall
  shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 1.4 * scale, rx: 6.2 * scale, ry: 4.2 * scale, fill: palette.light });
  shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 0.2 * scale, rx: 2.1 * scale, ry: 1.6 * scale, fill: palette.nose, stroked: true });

  if (hasWhiskers) {
    for (const direction of [-1, 1]) {
      for (const offset of [-2.2, 0, 2.2]) {
        shapes.push({
          kind: 'line', x1: centerX + direction * 7.4 * scale, y1: muzzleY + offset * scale,
          x2: centerX + direction * 14 * scale, y2: muzzleY + offset * 1.6 * scale,
          stroke: palette.outline, width: 0.8 * scale, opacity: 0.65,
        });
      }
    }
  }
}

function pushNeckwear(shapes: MascotShape[], palette: Palette, style: AccessoryStyle, centerX: number, neckY: number, headRadiusX: number, scale: number): void {
  if (style !== 'collar' && style !== 'ribbon') return;
  shapes.push({ kind: 'ellipse', cx: centerX, cy: neckY, rx: headRadiusX * 0.72, ry: 2.6 * scale, fill: palette.accessoryDark, stroked: true });
  if (style === 'ribbon') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: `M${centerX.toFixed(1)},${neckY.toFixed(1)} Q${(centerX + direction * 9 * scale).toFixed(1)},${(neckY - 6 * scale).toFixed(1)} ${(centerX + direction * 11 * scale).toFixed(1)},${neckY.toFixed(1)} Q${(centerX + direction * 9 * scale).toFixed(1)},${(neckY + 6 * scale).toFixed(1)} ${centerX.toFixed(1)},${neckY.toFixed(1)} Z`,
        fill: palette.accessory, stroked: true,
      });
    }
    shapes.push({ kind: 'ellipse', cx: centerX, cy: neckY, rx: 2.8 * scale, ry: 2.8 * scale, fill: palette.accessoryDark, stroked: true });
  }
}

function pushCrown(shapes: MascotShape[], palette: Palette, style: AccessoryStyle, centerX: number, crownBaseY: number, scale: number): void {
  if (style !== 'crown' && style !== 'crownGem') return;
  const top = Math.max(2, crownBaseY);
  const width = (style === 'crownGem' ? 11 : 9.4) * scale;
  const height = 8 * scale;
  const points = [
    [centerX - width, top + height], [centerX - width, top + height * 0.4],
    [centerX - width * 0.55, top + height * 0.75], [centerX - width * 0.2, top],
    [centerX, top + height * 0.5], [centerX + width * 0.2, top],
    [centerX + width * 0.55, top + height * 0.75], [centerX + width, top + height * 0.4],
    [centerX + width, top + height],
  ];
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ') + ' Z';
  shapes.push({ kind: 'path', d, fill: palette.accessory, stroked: true });
  if (style === 'crownGem') {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: top + height * 0.66, rx: 2.2 * scale, ry: 2.2 * scale, fill: palette.gem, stroked: true });
    shapes.push({ kind: 'ellipse', cx: centerX - 0.7 * scale, cy: top + height * 0.55, rx: 0.7 * scale, ry: 0.7 * scale, fill: '#ffffff' });
  }
}

function pushAura(shapes: MascotShape[], palette: Palette, style: AuraStyle, centerX: number, centerY: number, frame: number): void {
  if (style === 'none') return;

  if (style === 'sparkle') {
    const points = frame === 0 ? [[18, 20], [80, 24], [20, 74], [78, 70]] : [[15, 30], [82, 18], [16, 65], [83, 78]];
    for (const [x, y] of points) shapes.push({ kind: 'path', d: starPath(x, y, 3.4), fill: palette.sparkle, opacity: 0.95 });
    return;
  }

  const isBig = style === 'burstBig';
  const innerRadius = isBig ? 36 : 32;
  const spokes = isBig ? 12 : 9;
  const spin = frame === 1 ? 8 : 0;

  shapes.push({ kind: 'circle', cx: centerX, cy: centerY, r: innerRadius + (isBig ? 10 : 7), fill: palette.aura, opacity: 0.22 });
  shapes.push({ kind: 'ring', cx: centerX, cy: centerY, r: innerRadius, stroke: palette.auraCore, width: isBig ? 2.6 : 2, opacity: 0.85 });

  for (let index = 0; index < spokes; index += 1) {
    const angle = ((360 / spokes) * index + spin) * (Math.PI / 180);
    const long = index % 2 === 0;
    const outer = innerRadius + (long ? (isBig ? 22 : 15) : isBig ? 14 : 9);
    shapes.push({
      kind: 'line',
      x1: centerX + Math.cos(angle) * (innerRadius - 2), y1: centerY + Math.sin(angle) * (innerRadius - 2),
      x2: centerX + Math.cos(angle) * outer, y2: centerY + Math.sin(angle) * outer,
      stroke: long ? palette.flame : palette.aura, width: long ? 4.2 : 2.6, opacity: 0.95,
    });
  }

  if (isBig) {
    const sparklePoints: Array<[number, number]> = frame === 0 ? [[10, 12], [90, 15], [8, 85], [92, 82]] : [[8, 22], [92, 24], [12, 75], [88, 90]];
    for (const [x, y] of sparklePoints) shapes.push({ kind: 'path', d: starPath(x, y, 3.2), fill: palette.sparkle, opacity: 0.95 });
  }
}

function pushWings(shapes: MascotShape[], palette: Palette, centerX: number, bodyCenterY: number, bodyRadiusX: number, scale: number, lift: number, outlineWidth: number): void {
  void outlineWidth;
  for (const direction of [-1, 1]) {
    const originX = centerX + direction * (bodyRadiusX - 3);
    const originY = bodyCenterY - 8 * scale + lift;
    shapes.push({ kind: 'path', d: leafPath(originX, originY, direction, 24 * scale, 10.5 * scale), fill: palette.accessoryDark, stroked: true });
    shapes.push({ kind: 'path', d: leafPath(originX, originY - 2, direction, 15 * scale, 5.6 * scale), fill: palette.accessory });
  }
}

function pushTail(shapes: MascotShape[], palette: Palette, style: TailKind, tailX: number, bodyCenterY: number, bodyRadiusY: number, scale: number, frame: number): void {
  const wag = frame === 1 ? -1 : 1;
  switch (style) {
    case 'wagPuppy':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY, wag, 14 * scale, 4 * scale), fill: palette.shade, stroked: true });
      break;
    case 'furryDog':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY - bodyRadiusY * 0.2, wag, 18 * scale, 5.6 * scale), fill: palette.shade, stroked: true });
      shapes.push({ kind: 'ellipse', cx: tailX + wag * 16 * scale, cy: bodyCenterY - bodyRadiusY * 0.6, rx: 3.6 * scale, ry: 3.6 * scale, fill: palette.light });
      break;
    case 'wolfBrush':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY, wag, 26 * scale, 7.2 * scale), fill: palette.shade, stroked: true });
      shapes.push({ kind: 'path', d: leafPath(tailX + wag * 4 * scale, bodyCenterY + 2 * scale, wag, 20 * scale, 4.4 * scale), fill: palette.deepShade });
      break;
    case 'catCurl':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY, wag, 20 * scale, 4.6 * scale), fill: palette.shade, stroked: true });
      shapes.push({ kind: 'ellipse', cx: tailX + wag * 18 * scale, cy: bodyCenterY - 10 * scale, rx: 3 * scale, ry: 3 * scale, fill: palette.base, stroked: true });
      break;
    case 'lionTuft':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY, wag, 24 * scale, 4.2 * scale), fill: palette.shade, stroked: true });
      shapes.push({ kind: 'circle', cx: tailX + wag * 22 * scale, cy: bodyCenterY - 12 * scale, r: 4.6 * scale, fill: palette.deepShade, stroked: true });
      break;
    case 'cubStub':
      shapes.push({ kind: 'circle', cx: tailX + 2 * scale, cy: bodyCenterY + 4 * scale, r: 3 * scale, fill: palette.shade, stroked: true });
      break;
    case 'raccoonRings': {
      for (let step = 0; step < 5; step += 1) {
        const size = (4.8 - step * 0.5) * scale;
        shapes.push({
          kind: 'circle', cx: tailX + (3 + step * 3.4) * scale, cy: bodyCenterY + step * 1.6 * scale,
          r: size, fill: step % 2 === 0 ? palette.deepShade : palette.light, stroked: true,
        });
      }
      break;
    }
    case 'grizzlyStub':
      shapes.push({ kind: 'circle', cx: tailX + 1.6 * scale, cy: bodyCenterY + 5 * scale, r: 2.6 * scale, fill: palette.shade, stroked: true });
      break;
    case 'sparrowShort':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY, wag, 12 * scale, 4.4 * scale), fill: palette.shade, stroked: true });
      break;
    case 'hawkFan':
      for (const spread of [-1, 0, 1]) {
        shapes.push({ kind: 'path', d: leafPath(tailX + spread * 2 * scale, bodyCenterY + Math.abs(spread) * scale, 1, (18 - Math.abs(spread) * 3) * scale, 3.4 * scale), fill: spread === 0 ? palette.shade : palette.deepShade, stroked: true });
      }
      break;
    case 'phoenixPlumes':
      for (const spread of [-1.4, -0.5, 0.5, 1.4]) {
        shapes.push({
          kind: 'path',
          d: leafPath(tailX, bodyCenterY + spread * 2 * scale, 1, (26 - Math.abs(spread) * 5) * scale, 3 * scale),
          fill: spread % 1 === 0 ? palette.flame : palette.accessory, stroked: true,
        });
      }
      break;
    case 'dragonTail':
      shapes.push({ kind: 'path', d: leafPath(tailX, bodyCenterY + 6 * scale, wag, 30 * scale, 5.6 * scale), fill: palette.base, stroked: true });
      for (const step of [0.35, 0.6, 0.85]) {
        shapes.push({
          kind: 'path',
          d: leafPath(tailX + wag * 30 * scale * step, bodyCenterY + 6 * scale - 4 * scale * step, 0, 3.2 * scale, 1.4 * scale),
          fill: palette.deepShade,
        });
      }
      break;
    case 'none':
    default:
      break;
  }
}
