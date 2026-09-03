import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';
import { buildPalette, type Palette } from './palette';

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
  /** 背景から前面へ、描く順に並んでいる */
  shapes: MascotShape[];
  bodyGradientId: string;
};

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, ratio));
}

/**
 * 頂点の並びから、なめらかに閉じた輪郭パスをつくる。各頂点を制御点にして
 * 隣り合う辺の中点どうしを結ぶので、頂点をどれだけ動かしても角が立たない。
 * 頭に鼻づらを食い込ませるなど、1本の輪郭で顔の凹凸を表すのに使う。
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

/** 正規化した頂点（中心からの倍率）を、実際の座標に展開してから輪郭パスにする。 */
function silhouettePath(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  normalizedPoints: ReadonlyArray<readonly [number, number]>,
): string {
  return smoothClosedPath(normalizedPoints.map(([nx, ny]) => [centerX + nx * radiusX, centerY + ny * radiusY]));
}

/**
 * 種族ごとの頭のシルエット（鼻づらを含めて1本の輪郭にする）。
 * -1〜1くらいの倍率で、頭の中心からの相対位置を表す。yは下がプラス。
 */
const HEAD_SILHOUETTES: Record<CharacterSpecies, ReadonlyArray<readonly [number, number]>> = {
  cat: [
    [0, -1], [0.68, -0.75], [0.98, -0.05], [0.82, 0.55],
    [0.4, 0.95], [0, 1.08], [-0.4, 0.95],
    [-0.82, 0.55], [-0.98, -0.05], [-0.68, -0.75],
  ],
  dog: [
    [0, -1], [0.7, -0.72], [1, -0.05], [0.78, 0.42],
    [0.55, 0.82], [0.22, 1.26], [-0.22, 1.26], [-0.55, 0.82],
    [-0.78, 0.42], [-1, -0.05], [-0.7, -0.72],
  ],
  rabbit: [
    [0, -1], [0.72, -0.74], [0.96, 0], [0.78, 0.6],
    [0.32, 0.96], [0, 1.05], [-0.32, 0.96],
    [-0.78, 0.6], [-0.96, 0], [-0.72, -0.74],
  ],
  bear: [
    [0, -0.98], [0.76, -0.68], [1.06, 0], [0.92, 0.5],
    [0.55, 0.86], [0, 1.16], [-0.55, 0.86],
    [-0.92, 0.5], [-1.06, 0], [-0.76, -0.68],
  ],
  penguin: [
    [0, -1], [0.72, -0.72], [0.98, 0], [0.72, 0.72],
    [0, 1], [-0.72, 0.72], [-0.98, 0], [-0.72, -0.72],
  ],
  dragon: [
    [0.34, -1.05], [0.72, -0.68], [0.96, -0.1], [0.7, 0.5],
    [0.4, 0.92], [0, 1.3], [-0.4, 0.92],
    [-0.7, 0.5], [-0.96, -0.1], [-0.72, -0.68], [-0.34, -1.05],
  ],
};

/** 頭の輪郭のうち、鼻先がどこまで伸びているか（muzzleYの基準に使う）。 */
const HEAD_SNOUT_DEPTH: Record<CharacterSpecies, number> = {
  cat: 1.02, dog: 1.18, rabbit: 0.98, bear: 1.06, penguin: 0.9, dragon: 1.15,
};

/**
 * 種族ごとの胴のシルエット。哺乳類は座った動物らしい「腰」のふくらみを、
 * ぺんぎんは足の見えない縦長のたまご形にする。
 */
const BODY_SILHOUETTES: Record<CharacterSpecies, ReadonlyArray<readonly [number, number]>> = {
  cat: [
    [0, -1], [0.72, -0.82], [0.92, -0.32], [0.8, 0.2],
    [0.95, 0.7], [0.5, 1], [0, 1.05], [-0.5, 1],
    [-0.95, 0.7], [-0.8, 0.2], [-0.92, -0.32], [-0.72, -0.82],
  ],
  dog: [
    [0, -1], [0.78, -0.8], [0.98, -0.3], [0.86, 0.22],
    [1, 0.72], [0.52, 1], [0, 1.05], [-0.52, 1],
    [-1, 0.72], [-0.86, 0.22], [-0.98, -0.3], [-0.78, -0.8],
  ],
  rabbit: [
    [0, -1], [0.66, -0.84], [0.85, -0.35], [0.72, 0.18],
    [0.88, 0.72], [0.46, 1.02], [0, 1.08], [-0.46, 1.02],
    [-0.88, 0.72], [-0.72, 0.18], [-0.85, -0.35], [-0.66, -0.84],
  ],
  bear: [
    [0, -1], [0.85, -0.8], [1.04, -0.28], [0.92, 0.22],
    [1.08, 0.72], [0.56, 1], [0, 1.04], [-0.56, 1],
    [-1.08, 0.72], [-0.92, 0.22], [-1.04, -0.28], [-0.85, -0.8],
  ],
  penguin: [
    [0, -1], [0.62, -0.9], [0.95, -0.15], [0.86, 0.55],
    [0.42, 0.96], [0, 1.05], [-0.42, 0.96],
    [-0.86, 0.55], [-0.95, -0.15], [-0.62, -0.9],
  ],
  dragon: [
    [0, -1], [0.66, -0.86], [0.9, -0.15], [0.8, 0.5],
    [0.38, 0.94], [0, 1.02], [-0.38, 0.94],
    [-0.8, 0.5], [-0.9, -0.15], [-0.66, -0.86],
  ],
};

type EarStyle = 'pointed' | 'floppy' | 'tall' | 'round' | 'none' | 'horns';
type TailStyle = 'long' | 'stubby' | 'puff' | 'tiny' | 'none' | 'spiky';
/** 目のかたち。種族ごとの見分けやすさは、これがいちばん効く。 */
type EyeShape = 'almond' | 'roundBig' | 'roundSmall' | 'simple' | 'slit';
/** 鼻づら。種族の輪郭そのものを変える。 */
type MuzzleKind = 'catSmall' | 'dogSnout' | 'rabbitSmall' | 'bearRound' | 'dragonSnout' | 'beak';

type SpeciesTraits = {
  ears: EarStyle;
  tail: TailStyle;
  muzzle: MuzzleKind;
  eyeShape: EyeShape;
  /** 目の傾き（度）。＋であるほど目尻が上がる */
  eyeTilt: number;
  /** 目と目の間の開き方の倍率 */
  eyeSpreadFactor: number;
  hasWhiskers: boolean;
  /** ぺんぎんの白いお腹・顔まわりの二色づかい */
  hasTwoTone: boolean;
  hasWings: boolean;
  hasBuckTeeth: boolean;
  hasSpineSpikes: boolean;
  /** 胴の幅の倍率。種族ごとの体格差をここで出す */
  bodyWidthMul: number;
  /** 胴の高さの倍率。ぺんぎんのように縦に長い体型はここで作る */
  bodyHeightMul: number;
  /** 頭の幅の倍率 */
  headWidthMul: number;
  /** 頭の高さの倍率 */
  headHeightMul: number;
};

const SPECIES_TRAITS: Record<CharacterSpecies, SpeciesTraits> = {
  cat: {
    ears: 'pointed', tail: 'long', muzzle: 'catSmall',
    eyeShape: 'almond', eyeTilt: 11, eyeSpreadFactor: 1,
    hasWhiskers: true, hasTwoTone: false, hasWings: false, hasBuckTeeth: false, hasSpineSpikes: false,
    bodyWidthMul: 0.92, bodyHeightMul: 0.98, headWidthMul: 0.98, headHeightMul: 1,
  },
  dog: {
    ears: 'floppy', tail: 'stubby', muzzle: 'dogSnout',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 0.92,
    hasWhiskers: false, hasTwoTone: false, hasWings: false, hasBuckTeeth: false, hasSpineSpikes: false,
    bodyWidthMul: 1.06, bodyHeightMul: 1.02, headWidthMul: 1.06, headHeightMul: 1.02,
  },
  rabbit: {
    ears: 'tall', tail: 'puff', muzzle: 'rabbitSmall',
    eyeShape: 'roundBig', eyeTilt: 0, eyeSpreadFactor: 1,
    hasWhiskers: true, hasTwoTone: false, hasWings: false, hasBuckTeeth: true, hasSpineSpikes: false,
    bodyWidthMul: 0.88, bodyHeightMul: 1.08, headWidthMul: 0.94, headHeightMul: 1,
  },
  bear: {
    ears: 'round', tail: 'tiny', muzzle: 'bearRound',
    eyeShape: 'roundSmall', eyeTilt: 0, eyeSpreadFactor: 0.86,
    hasWhiskers: false, hasTwoTone: false, hasWings: false, hasBuckTeeth: false, hasSpineSpikes: false,
    bodyWidthMul: 1.2, bodyHeightMul: 1.08, headWidthMul: 1.1, headHeightMul: 1.04,
  },
  penguin: {
    ears: 'none', tail: 'none', muzzle: 'beak',
    eyeShape: 'simple', eyeTilt: 0, eyeSpreadFactor: 0.9,
    hasWhiskers: false, hasTwoTone: true, hasWings: false, hasBuckTeeth: false, hasSpineSpikes: false,
    bodyWidthMul: 0.8, bodyHeightMul: 1.32, headWidthMul: 0.86, headHeightMul: 0.86,
  },
  dragon: {
    ears: 'horns', tail: 'spiky', muzzle: 'dragonSnout',
    eyeShape: 'slit', eyeTilt: 8, eyeSpreadFactor: 1,
    hasWhiskers: false, hasTwoTone: false, hasWings: true, hasBuckTeeth: false, hasSpineSpikes: true,
    bodyWidthMul: 0.86, bodyHeightMul: 1, headWidthMul: 0.92, headHeightMul: 0.96,
  },
};

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
  bonusWings: boolean;
};

/**
 * 10段階の見た目テーブル。よれよれ→かわいい→かっこいいの流れが
 * ひと目で伝わるよう、色だけでなく形・表情・演出を段階ごとに変える。
 * eyes が 'hero' の2段階だけは、種族を問わず共通の凛々しい目に差し替わる
 * （最終段階は動物らしさより「かっこよさ」を優先してよいため）。
 */
const STAGE_LOOKS: StageLook[] = [
  { scale: 0.82, coatMix: 0.0, eyes: 'droopy', mouth: 'sad', blush: false, accessory: 'none', aura: 'none', bonusWings: false },
  { scale: 0.88, coatMix: 0.08, eyes: 'droopy', mouth: 'sad', blush: false, accessory: 'none', aura: 'none', bonusWings: false },
  { scale: 0.94, coatMix: 0.24, eyes: 'round', mouth: 'smile', blush: true, accessory: 'collar', aura: 'none', bonusWings: false },
  { scale: 0.99, coatMix: 0.4, eyes: 'round', mouth: 'smile', blush: true, accessory: 'collar', aura: 'none', bonusWings: false },
  { scale: 1.04, coatMix: 0.54, eyes: 'round', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'none', bonusWings: false },
  { scale: 1.08, coatMix: 0.67, eyes: 'sparkle', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'none', bonusWings: false },
  { scale: 1.13, coatMix: 0.78, eyes: 'sparkle', mouth: 'smile', blush: true, accessory: 'ribbon', aura: 'sparkle', bonusWings: false },
  { scale: 1.18, coatMix: 0.88, eyes: 'sparkle', mouth: 'grin', blush: true, accessory: 'crown', aura: 'sparkle', bonusWings: false },
  { scale: 1.25, coatMix: 0.96, eyes: 'hero', mouth: 'grin', blush: false, accessory: 'crownGem', aura: 'burstSmall', bonusWings: false },
  { scale: 1.34, coatMix: 1.0, eyes: 'hero', mouth: 'grin', blush: false, accessory: 'crownGem', aura: 'burstBig', bonusWings: true },
];

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

const CENTER_X = 50;
const HEAD_CENTER_Y = 41;
const BODY_CENTER_Y = 74;

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

/**
 * 葉っぱのようになめらかな雫形。左右対称の2本の三次ベジェで閉じるので、
 * 継ぎ目に折れ目が出ない。耳・尻尾・翼・とげに使う共通パーツ。
 */
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

export type MascotInput = {
  species: CharacterSpecies;
  /** 0（細い）〜1（太い） */
  shapeValue: number;
  /** 0〜9 */
  growthStage: number;
  condition: CharacterCondition;
  /** 待機アニメーションのコマ。0か1 */
  frame?: number;
};

/** 体型・成長段階・調子から、SVGで描くための形の一覧をつくる。 */
export function buildMascotArtwork(input: MascotInput): MascotArtwork {
  const { species, condition } = input;
  const shapeValue = Math.min(1, Math.max(0, input.shapeValue));
  const growthStage = Math.min(9, Math.max(0, Math.round(input.growthStage)));
  const frame = input.frame === 1 ? 1 : 0;

  const stageLook = STAGE_LOOKS[growthStage];
  const traits = SPECIES_TRAITS[species];
  const isExhausted = condition === 'exhausted';

  const palette = buildPalette({ species, coatMix: stageLook.coatMix, condition });
  const shapes: MascotShape[] = [];

  const droop = isExhausted ? 1 : condition === 'tired' ? 0.5 : 0;
  const bounce = frame === 1 && !isExhausted ? -0.8 : 0;
  const scale = stageLook.scale;
  const outlineWidth = 1.6 + scale * 0.6;

  const bodyHalfWidth = lerp(13, 31, shapeValue) * 0.86 * scale * traits.bodyWidthMul;
  const bodyRadiusY = lerp(16, 21.5, shapeValue) * scale * traits.bodyHeightMul;
  const bodyCenterY = BODY_CENTER_Y + bounce;

  const headRadiusX = lerp(24, 29, shapeValue * 0.35) * scale * traits.headWidthMul;
  const headRadiusY = lerp(23, 27, shapeValue * 0.3) * scale * traits.headHeightMul;
  const slouch = growthStage <= 1 ? 2.2 : growthStage <= 3 ? 1 : 0;
  const headCenterY = HEAD_CENTER_Y + bounce + droop * 1.5 + slouch;

  const effectiveEyes: EyeStyle | 'x' = isExhausted ? 'x' : stageLook.eyes;
  const effectiveMouth: MouthStyle = isExhausted ? 'sad' : stageLook.mouth;
  const effectiveAura: AuraStyle = isExhausted ? 'none' : stageLook.aura;
  const effectiveBlush = stageLook.blush && !isExhausted;
  const hasWings = traits.hasWings || (stageLook.bonusWings && !isExhausted);

  const bodyGradientId = `mg-${palette.base.slice(1)}-${palette.light.slice(1)}`;
  shapes.push({
    kind: 'gradient-def',
    id: bodyGradientId,
    from: palette.light,
    to: palette.base,
    x1: 30,
    y1: 10,
    x2: 70,
    y2: 95,
  });

  // ---- 後光（体より奥） ----
  if (effectiveAura !== 'none') {
    pushAura(shapes, palette, effectiveAura, CENTER_X, bodyCenterY - 4, frame);
  }

  // ---- 翼（胴より奥） ----
  if (hasWings) {
    pushWings(shapes, palette, CENTER_X, bodyCenterY, bodyHalfWidth, scale, bounce, outlineWidth);
  }

  // ---- 尻尾 ----
  pushTail(shapes, palette, traits.tail, CENTER_X + bodyHalfWidth, bodyCenterY, scale, frame, outlineWidth);

  // ---- 足 ----
  const footRadius = lerp(4.2, 7, shapeValue) * scale;
  const footY = bodyCenterY + bodyRadiusY - footRadius * 0.5;
  const footColor = species === 'penguin' ? palette.accessory : palette.shade;
  shapes.push(
    { kind: 'ellipse', cx: CENTER_X - bodyHalfWidth * 0.55, cy: footY, rx: footRadius, ry: footRadius * 0.72, fill: footColor, stroked: true },
    { kind: 'ellipse', cx: CENTER_X + bodyHalfWidth * 0.55, cy: footY, rx: footRadius, ry: footRadius * 0.72, fill: footColor, stroked: true },
  );

  // ---- 胴。楕円ではなく種族ごとのシルエットにする ----
  shapes.push({
    kind: 'path',
    d: silhouettePath(CENTER_X, bodyCenterY, bodyHalfWidth, bodyRadiusY, BODY_SILHOUETTES[species]),
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

  if (traits.hasSpineSpikes) {
    for (let step = 0; step < 3; step += 1) {
      const y = bodyCenterY - bodyRadiusY * (0.75 - step * 0.5);
      shapes.push({
        kind: 'path',
        d: leafPath(CENTER_X, y, 1, 4.5 * scale, 1.6 * scale),
        fill: palette.accessoryDark,
        stroked: true,
        opacity: 0.95,
      });
    }
  }

  if (traits.hasTwoTone) {
    // ぺんぎんの白いお腹と顔まわり
    shapes.push({
      kind: 'ellipse',
      cx: CENTER_X,
      cy: bodyCenterY + bodyRadiusY * 0.15,
      rx: bodyHalfWidth * 0.68,
      ry: bodyRadiusY * 0.78,
      fill: palette.light,
    });
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X + direction * (bodyHalfWidth - 1),
        cy: bodyCenterY,
        rx: 4.4 * scale,
        ry: 11 * scale,
        fill: footColor,
        stroked: true,
        rotate: direction * 18,
      });
    }
  }

  if (shapeValue < 0.1 && stageLook.coatMix > 0.2) {
    for (const offset of [-5, 0, 5]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X,
        cy: bodyCenterY + offset * scale,
        rx: bodyHalfWidth * 0.55,
        ry: 1.1 * scale,
        fill: palette.shade,
        opacity: 0.6,
      });
    }
  }

  // ---- 耳（頭より奥） ----
  pushEars(shapes, palette, traits.ears, CENTER_X, headRadiusX, headCenterY, headRadiusY, droop, scale, outlineWidth);

  // ---- 頭。鼻づらを含めて1本の輪郭にする（種族の見分けやすさの要） ----
  shapes.push({
    kind: 'path',
    d: silhouettePath(CENTER_X, headCenterY, headRadiusX, headRadiusY, HEAD_SILHOUETTES[species]),
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

  if (traits.hasSpineSpikes) {
    shapes.push({
      kind: 'path',
      d: leafPath(CENTER_X, headCenterY - headRadiusY * 0.85, 1, 5 * scale, 1.7 * scale),
      fill: palette.accessoryDark,
      stroked: true,
    });
  }

  if (shapeValue > 0.7) {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X + direction * headRadiusX * 0.86,
        cy: headCenterY + headRadiusY * 0.28,
        rx: headRadiusX * 0.3,
        ry: headRadiusY * 0.26,
        fill: palette.base,
      });
    }
  }

  if (traits.hasTwoTone) {
    // 顔のまわりだけ白い、ぺんぎんの特徴
    shapes.push({
      kind: 'ellipse',
      cx: CENTER_X,
      cy: headCenterY + headRadiusY * 0.18,
      rx: headRadiusX * 0.62,
      ry: headRadiusY * 0.58,
      fill: palette.light,
    });
  }

  // つやハイライト。トイのような光沢
  shapes.push({
    kind: 'ellipse',
    cx: CENTER_X - headRadiusX * 0.42,
    cy: headCenterY - headRadiusY * 0.52,
    rx: headRadiusX * 0.3,
    ry: headRadiusY * 0.18,
    fill: '#ffffff',
    opacity: 0.5,
    rotate: -20,
  });

  const eyeSpread = headRadiusX * 0.44 * traits.eyeSpreadFactor;
  const eyeY = headCenterY - headRadiusY * 0.02;
  if (effectiveEyes === 'x') {
    pushExhaustedEyes(shapes, palette, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale);
  } else {
    pushEyes(shapes, palette, effectiveEyes, traits.eyeShape, traits.eyeTilt, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale, outlineWidth);
  }

  if (traits.muzzle === 'dragonSnout') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X + direction * headRadiusX * 0.34,
        cy: eyeY - headRadiusY * 0.62,
        rx: headRadiusX * 0.1,
        ry: headRadiusY * 0.06,
        fill: palette.accessoryDark,
        rotate: direction * 30,
      });
    }
  }

  // 鼻づらの位置は、頭の輪郭が実際にどこまで伸びているか（HEAD_SNOUT_DEPTH）を基準にする
  const muzzleY = headCenterY + headRadiusY * (HEAD_SNOUT_DEPTH[species] * 0.62);
  pushMuzzle(shapes, palette, traits.muzzle, traits.hasWhiskers, traits.hasBuckTeeth, CENTER_X, muzzleY, scale, outlineWidth);
  pushMouth(shapes, palette, effectiveMouth, species, CENTER_X, muzzleY + headRadiusY * 0.24, scale);

  // ---- 首まわりの飾り。あごのすぐ下、頭の前面に乗せる ----
  pushNeckwear(shapes, palette, stageLook.accessory, CENTER_X, headCenterY + headRadiusY * 1.04, bodyHalfWidth, scale, outlineWidth);

  if (effectiveBlush) {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X + direction * headRadiusX * 0.66,
        cy: headCenterY + headRadiusY * 0.34,
        rx: headRadiusX * 0.16,
        ry: headRadiusY * 0.11,
        fill: palette.blush,
        opacity: 0.85,
      });
    }
  }

  if (growthStage <= 1) {
    const patches: Array<[number, number, number]> = [
      [CENTER_X - bodyHalfWidth * 0.4, bodyCenterY - 4, 4],
      [CENTER_X + bodyHalfWidth * 0.45, bodyCenterY + 4, 3.2],
    ];
    for (const [x, y, radius] of patches) {
      shapes.push({ kind: 'ellipse', cx: x, cy: y, rx: radius, ry: radius * 0.7, fill: palette.deepShade, opacity: 0.7 });
    }
    const tufts: Array<[number, number, number]> = [
      [CENTER_X - headRadiusX - 1, headCenterY - headRadiusY + 3, -1],
      [CENTER_X + headRadiusX + 1, headCenterY - headRadiusY + 6, 1],
      [CENTER_X + 6, headCenterY - headRadiusY - 2, -1],
    ];
    for (const [x, y, dir] of tufts) {
      shapes.push({ kind: 'path', d: leafPath(x, y, dir, 6, 1.4), fill: palette.deepShade, opacity: 0.85 });
    }
  }

  const earsRiseUp = traits.ears === 'pointed' || traits.ears === 'tall';
  const crownBaseY = headCenterY - headRadiusY - (earsRiseUp ? 12 : 5) * scale + droop * 2;
  pushCrown(shapes, palette, stageLook.accessory, CENTER_X, crownBaseY, scale, outlineWidth);

  if (isExhausted) {
    shapes.push({
      kind: 'path',
      d: `M${(CENTER_X + headRadiusX + 2).toFixed(1)},${(headCenterY - headRadiusY * 0.3).toFixed(1)} q3,4 0,8 q-3,-2 0,-8 Z`,
      fill: '#8ec9e8',
      opacity: 0.9,
    });
  }

  return {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    outlineColor: palette.outline,
    outlineWidth,
    shapes,
    bodyGradientId,
  };
}

function pushEars(
  shapes: MascotShape[],
  palette: Palette,
  style: EarStyle,
  headCenterX: number,
  headRadiusX: number,
  headCenterY: number,
  headRadiusY: number,
  droop: number,
  scale: number,
  outlineWidth: number,
): void {
  void outlineWidth;
  const headTop = headCenterY - headRadiusY;
  const leftX = headCenterX - headRadiusX * 0.6;
  const rightX = headCenterX + headRadiusX * 0.6;

  if (style === 'pointed') {
    const apexY = headTop + 4 * scale + droop * 4;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: leafPath(x, apexY, dir, 15 * scale, 6.5 * scale), fill: palette.base, stroked: true });
      shapes.push({ kind: 'path', d: leafPath(x, apexY - 1, dir, 9 * scale, 3.2 * scale), fill: palette.nose });
    }
    return;
  }

  if (style === 'floppy') {
    const earTop = headTop + 8 * scale + droop * 3;
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: headCenterX + direction * (headRadiusX + 1),
        cy: earTop + 12 * scale,
        rx: 7.4 * scale,
        ry: 14 * scale,
        fill: palette.shade,
        stroked: true,
        rotate: direction * 12,
      });
      shapes.push({
        kind: 'ellipse',
        cx: headCenterX + direction * (headRadiusX + 1),
        cy: earTop + 12 * scale,
        rx: 3.6 * scale,
        ry: 9 * scale,
        fill: palette.deepShade,
        rotate: direction * 12,
      });
    }
    return;
  }

  if (style === 'tall') {
    const lean = droop * 5;
    const earHeight = 25 * scale;
    for (const direction of [-1, 1]) {
      const baseX = headCenterX + direction * 8 * scale;
      shapes.push({
        kind: 'ellipse',
        cx: baseX + direction * lean * 0.4,
        cy: headTop - earHeight * 0.42,
        rx: 4.2 * scale,
        ry: earHeight * 0.55,
        fill: palette.base,
        stroked: true,
        rotate: direction * (6 + lean),
      });
      shapes.push({
        kind: 'ellipse',
        cx: baseX + direction * lean * 0.4,
        cy: headTop - earHeight * 0.4,
        rx: 1.9 * scale,
        ry: earHeight * 0.4,
        fill: palette.nose,
        rotate: direction * (6 + lean),
      });
    }
    return;
  }

  if (style === 'round') {
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: 7.6 * scale, fill: palette.base, stroked: true });
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: 3.3 * scale, fill: palette.nose });
    }
    return;
  }

  if (style === 'horns') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: leafPath(headCenterX + direction * 9 * scale, headTop + 4 * scale, direction, 13 * scale, 3.2 * scale),
        fill: palette.accessoryDark,
        stroked: true,
      });
    }
  }
}

/** 目のかたちに、種族の見分けやすさをいちばん強く持たせる。 */
function pushEyes(
  shapes: MascotShape[],
  palette: Palette,
  style: EyeStyle,
  eyeShape: EyeShape,
  tilt: number,
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
  scale: number,
  outlineWidth: number,
): void {
  if (style === 'droopy') {
    // 眠そうに半分閉じた目。暗い影を重ねず、やさしい弧の線1本だけで表す
    const half = 5.2 * scale;
    const bow = 2.6 * scale;
    for (const eyeX of [leftEyeX, rightEyeX]) {
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - half).toFixed(1)},${eyeY.toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY + bow).toFixed(1)} ${(eyeX + half).toFixed(1)},${eyeY.toFixed(1)}`,
        fill: 'none',
        stroked: true,
      });
    }
    return;
  }

  if (style === 'hero') {
    // 最終段階だけの、種族を問わない共通の凛々しい目。虹彩の色を主役にする
    for (const eyeX of [leftEyeX, rightEyeX]) {
      const direction = eyeX < CENTER_X ? -1 : 1;
      shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx: 6 * scale, ry: 4.3 * scale, fill: palette.eye, stroked: true, rotate: -direction * 6 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 0.6, cy: eyeY + 0.6 * scale, rx: 2.3 * scale, ry: 2.6 * scale, fill: palette.eyeDark, rotate: -direction * 6 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 1.6, cy: eyeY - 1, rx: 1.3 * scale, ry: 1.8 * scale, fill: palette.eyeHighlight });
      // 少しだけ吊り上がった、決意を感じさせるまぶた
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - 6.2 * scale).toFixed(1)},${(eyeY - 3.4 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 6.4 * scale).toFixed(1)} ${(eyeX + 6.2 * scale).toFixed(1)},${(eyeY - direction * 1.6 * scale).toFixed(1)} L${(eyeX + 5.6 * scale).toFixed(1)},${(eyeY - direction * 0.2 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 4 * scale).toFixed(1)} ${(eyeX - 5.6 * scale).toFixed(1)},${(eyeY - 1.6 * scale).toFixed(1)} Z`,
        fill: palette.deepShade,
      });
    }
    return;
  }

  if (eyeShape === 'simple') {
    // ぺんぎんの、つぶらでシンプルな目
    const radius = (style === 'sparkle' ? 4.6 : 4.1) * scale;
    for (const eyeX of [leftEyeX, rightEyeX]) {
      shapes.push({ kind: 'circle', cx: eyeX, cy: eyeY, r: radius, fill: palette.eyeDark });
      shapes.push({ kind: 'circle', cx: eyeX - radius * 0.32, cy: eyeY - radius * 0.34, r: radius * 0.34, fill: palette.eyeHighlight });
    }
    return;
  }

  const baseRadius = style === 'sparkle' ? 7.6 * scale : 6.6 * scale;
  const shapeRatio: Record<EyeShape, { rx: number; ry: number }> = {
    almond: { rx: 1.12, ry: 0.82 },
    roundBig: { rx: 1.08, ry: 1.12 },
    roundSmall: { rx: 0.86, ry: 0.9 },
    simple: { rx: 1, ry: 1 },
    slit: { rx: 0.68, ry: 1.22 },
  };
  const ratio = shapeRatio[eyeShape];
  const rx = baseRadius * ratio.rx;
  const ry = baseRadius * ratio.ry;

  for (const eyeX of [leftEyeX, rightEyeX]) {
    const direction = eyeX < CENTER_X ? -1 : 1;
    const rotate = tilt * direction * -1;
    // 虹彩そのものを主役にする。黒い土台を先に敷かないので、虫のような
    // 縁取りにならない。輪郭線は虹彩の縁に直接つける
    shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx, ry, fill: palette.eye, stroked: true, rotate });
    // 瞳孔は小さく、虹彩の下寄りに
    shapes.push({
      kind: 'ellipse',
      cx: eyeX,
      cy: eyeY + ry * 0.22,
      rx: rx * 0.4,
      ry: ry * 0.44,
      fill: palette.eyeDark,
      rotate,
    });
    shapes.push({
      kind: 'ellipse',
      cx: eyeX - rx * 0.3,
      cy: eyeY - ry * 0.34,
      rx: rx * 0.3,
      ry: ry * 0.36,
      fill: palette.eyeHighlight,
    });
    if (style === 'sparkle') {
      shapes.push({ kind: 'ellipse', cx: eyeX + rx * 0.38, cy: eyeY + ry * 0.36, rx: rx * 0.14, ry: ry * 0.15, fill: palette.eyeHighlight, opacity: 0.9 });
    }
  }
  void outlineWidth;
}

function pushExhaustedEyes(
  shapes: MascotShape[],
  palette: Palette,
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
  scale: number,
): void {
  const half = 5 * scale;
  for (const eyeX of [leftEyeX, rightEyeX]) {
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY - half, x2: eyeX + half, y2: eyeY + half, stroke: palette.outline, width: 2.2 * scale });
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY + half, x2: eyeX + half, y2: eyeY - half, stroke: palette.outline, width: 2.2 * scale });
  }
}

function pushMouth(
  shapes: MascotShape[],
  palette: Palette,
  style: MouthStyle,
  species: CharacterSpecies,
  centerX: number,
  mouthY: number,
  scale: number,
): void {
  if (species === 'penguin' && style !== 'grin') return;

  if (style === 'sad') {
    shapes.push({ kind: 'line', x1: centerX - 5.6 * scale, y1: mouthY + 2 * scale, x2: centerX, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
    shapes.push({ kind: 'line', x1: centerX + 5.6 * scale, y1: mouthY + 2 * scale, x2: centerX, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
    return;
  }

  if (style === 'grin') {
    shapes.push({
      kind: 'path',
      d: `M${(centerX - 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Q${centerX.toFixed(1)},${(mouthY + 9 * scale).toFixed(1)} ${(centerX + 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Q${centerX.toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} ${(centerX - 7 * scale).toFixed(1)},${mouthY.toFixed(1)} Z`,
      fill: palette.deepShade,
      stroked: true,
    });
    shapes.push({
      kind: 'path',
      d: `M${(centerX - 2.6 * scale).toFixed(1)},${(mouthY + 0.4 * scale).toFixed(1)} L${(centerX + 2.6 * scale).toFixed(1)},${(mouthY + 0.4 * scale).toFixed(1)} L${(centerX + 1.6 * scale).toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} L${(centerX - 1.6 * scale).toFixed(1)},${(mouthY + 3.4 * scale).toFixed(1)} Z`,
      fill: '#ffffff',
    });
    return;
  }

  // かわいい "w" のかたちの口。全種族に共通のチャームポイント
  shapes.push({ kind: 'line', x1: centerX - 5.6 * scale, y1: mouthY - 2 * scale, x2: centerX, y2: mouthY + 0.4 * scale, stroke: palette.outline, width: 2 * scale });
  shapes.push({ kind: 'line', x1: centerX, y1: mouthY + 0.4 * scale, x2: centerX + 5.6 * scale, y2: mouthY - 2 * scale, stroke: palette.outline, width: 2 * scale });
}

function pushMuzzle(
  shapes: MascotShape[],
  palette: Palette,
  kind: MuzzleKind,
  hasWhiskers: boolean,
  hasBuckTeeth: boolean,
  centerX: number,
  muzzleY: number,
  scale: number,
  outlineWidth: number,
): void {
  void outlineWidth;

  if (kind === 'beak') {
    // ひし形の、はっきり目立つくちばし
    const top = muzzleY - 3.4 * scale;
    const bottom = muzzleY + 5.6 * scale;
    const wing = 5.4 * scale;
    const mid = muzzleY + 1.2 * scale;
    shapes.push({
      kind: 'path',
      d: `M${centerX.toFixed(1)},${top.toFixed(1)} L${(centerX + wing).toFixed(1)},${mid.toFixed(1)} L${centerX.toFixed(1)},${bottom.toFixed(1)} L${(centerX - wing).toFixed(1)},${mid.toFixed(1)} Z`,
      fill: palette.accessory,
      stroked: true,
    });
    shapes.push({
      kind: 'line',
      x1: centerX,
      y1: top + 1 * scale,
      x2: centerX,
      y2: bottom - 1 * scale,
      stroke: palette.accessoryDark,
      width: 0.7 * scale,
      opacity: 0.8,
    });
    return;
  }

  if (kind === 'dogSnout') {
    // 頭の輪郭にすでに鼻づらの出っ張りがあるので、ここでは内側の色だけ足す
    // （二重の輪郭線を描かない）
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 2.6 * scale, rx: 7.6 * scale, ry: 5.2 * scale, fill: palette.light });
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 5.6 * scale, rx: 2.6 * scale, ry: 2 * scale, fill: palette.eyeDark, stroked: true });
    return;
  }

  if (kind === 'bearRound') {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 1.6 * scale, rx: 6.6 * scale, ry: 5.4 * scale, fill: palette.light });
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 4 * scale, rx: 2.4 * scale, ry: 1.8 * scale, fill: palette.eyeDark, stroked: true });
    return;
  }

  if (kind === 'dragonSnout') {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 1.6 * scale, rx: 6.4 * scale, ry: 3.8 * scale, fill: palette.light });
    for (const direction of [-1, 1]) {
      shapes.push({ kind: 'ellipse', cx: centerX + direction * 2 * scale, cy: muzzleY + 3.2 * scale, rx: 0.7 * scale, ry: 1 * scale, fill: palette.deepShade });
    }
    return;
  }

  // catSmall / rabbitSmall：小さくかわいい鼻づら
  shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 1.4 * scale, rx: 6.4 * scale, ry: 4.4 * scale, fill: palette.light });
  shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 0.2 * scale, rx: 2.1 * scale, ry: 1.6 * scale, fill: palette.nose, stroked: true });

  if (kind === 'catSmall') {
    for (const direction of [-1, 1]) {
      shapes.push({ kind: 'ellipse', cx: centerX + direction * 4.2 * scale, cy: muzzleY + 2.6 * scale, rx: 1.6 * scale, ry: 1.2 * scale, fill: palette.light, opacity: 0.9 });
    }
  }

  if (hasBuckTeeth) {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: `M${(centerX + direction * 1.3 * scale).toFixed(1)},${(muzzleY + 3 * scale).toFixed(1)} L${(centerX + direction * 2.2 * scale).toFixed(1)},${(muzzleY + 3 * scale).toFixed(1)} L${(centerX + direction * 2.2 * scale).toFixed(1)},${(muzzleY + 6.4 * scale).toFixed(1)} L${(centerX + direction * 1.3 * scale).toFixed(1)},${(muzzleY + 6.4 * scale).toFixed(1)} Z`,
        fill: '#fffdf6',
        stroked: true,
      });
    }
  }

  if (hasWhiskers) {
    for (const direction of [-1, 1]) {
      for (const offset of [-2.2, 0, 2.2]) {
        shapes.push({
          kind: 'line',
          x1: centerX + direction * 7.4 * scale,
          y1: muzzleY + offset * scale,
          x2: centerX + direction * 14 * scale,
          y2: muzzleY + offset * 1.6 * scale,
          stroke: palette.outline,
          width: 0.8 * scale,
          opacity: 0.65,
        });
      }
    }
  }
}

function pushNeckwear(
  shapes: MascotShape[],
  palette: Palette,
  style: AccessoryStyle,
  centerX: number,
  neckY: number,
  bodyHalfWidth: number,
  scale: number,
  outlineWidth: number,
): void {
  void outlineWidth;
  if (style !== 'collar' && style !== 'ribbon') return;

  shapes.push({
    kind: 'ellipse',
    cx: centerX,
    cy: neckY,
    rx: bodyHalfWidth * 0.78,
    ry: 2.6 * scale,
    fill: palette.accessoryDark,
    stroked: true,
  });

  if (style === 'ribbon') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: `M${centerX.toFixed(1)},${neckY.toFixed(1)} Q${(centerX + direction * 9 * scale).toFixed(1)},${(neckY - 6 * scale).toFixed(1)} ${(centerX + direction * 11 * scale).toFixed(1)},${neckY.toFixed(1)} Q${(centerX + direction * 9 * scale).toFixed(1)},${(neckY + 6 * scale).toFixed(1)} ${centerX.toFixed(1)},${neckY.toFixed(1)} Z`,
        fill: palette.accessory,
        stroked: true,
      });
    }
    shapes.push({ kind: 'ellipse', cx: centerX, cy: neckY, rx: 2.8 * scale, ry: 2.8 * scale, fill: palette.accessoryDark, stroked: true });
  }
}

function pushCrown(
  shapes: MascotShape[],
  palette: Palette,
  style: AccessoryStyle,
  centerX: number,
  crownBaseY: number,
  scale: number,
  outlineWidth: number,
): void {
  void outlineWidth;
  if (style !== 'crown' && style !== 'crownGem') return;

  const top = Math.max(2, crownBaseY);
  const width = (style === 'crownGem' ? 11 : 9.4) * scale;
  const height = 8 * scale;
  const points = [
    [centerX - width, top + height],
    [centerX - width, top + height * 0.4],
    [centerX - width * 0.55, top + height * 0.75],
    [centerX - width * 0.2, top],
    [centerX, top + height * 0.5],
    [centerX + width * 0.2, top],
    [centerX + width * 0.55, top + height * 0.75],
    [centerX + width, top + height * 0.4],
    [centerX + width, top + height],
  ];
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ') + ' Z';
  shapes.push({ kind: 'path', d, fill: palette.accessory, stroked: true });
  if (style === 'crownGem') {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: top + height * 0.66, rx: 2.2 * scale, ry: 2.2 * scale, fill: palette.gem, stroked: true });
    shapes.push({ kind: 'ellipse', cx: centerX - 0.7 * scale, cy: top + height * 0.55, rx: 0.7 * scale, ry: 0.7 * scale, fill: '#ffffff' });
  }
}

function pushAura(
  shapes: MascotShape[],
  palette: Palette,
  style: AuraStyle,
  centerX: number,
  centerY: number,
  frame: number,
): void {
  if (style === 'none') return;

  if (style === 'sparkle') {
    const points =
      frame === 0
        ? [
            [18, 20],
            [80, 24],
            [20, 74],
            [78, 70],
          ]
        : [
            [15, 30],
            [82, 18],
            [16, 65],
            [83, 78],
          ];
    for (const [x, y] of points) {
      shapes.push({ kind: 'path', d: starPath(x, y, 3.4), fill: palette.sparkle, opacity: 0.95 });
    }
    return;
  }

  const isBig = style === 'burstBig';
  const innerRadius = isBig ? 36 : 32;
  const spokes = isBig ? 12 : 9;
  const spin = frame === 1 ? 8 : 0;

  // やわらかい後光。半透明なので、どんな背景の上でも自然に馴染む
  shapes.push({ kind: 'circle', cx: centerX, cy: centerY, r: innerRadius + (isBig ? 10 : 7), fill: palette.aura, opacity: 0.22 });
  shapes.push({ kind: 'ring', cx: centerX, cy: centerY, r: innerRadius, stroke: palette.auraCore, width: isBig ? 2.6 : 2, opacity: 0.85 });

  for (let index = 0; index < spokes; index += 1) {
    const angle = ((360 / spokes) * index + spin) * (Math.PI / 180);
    const long = index % 2 === 0;
    const outer = innerRadius + (long ? (isBig ? 22 : 15) : isBig ? 14 : 9);
    const x1 = centerX + Math.cos(angle) * (innerRadius - 2);
    const y1 = centerY + Math.sin(angle) * (innerRadius - 2);
    const x2 = centerX + Math.cos(angle) * outer;
    const y2 = centerY + Math.sin(angle) * outer;
    shapes.push({
      kind: 'line',
      x1,
      y1,
      x2,
      y2,
      stroke: long ? palette.flame : palette.aura,
      width: long ? 4.2 : 2.6,
      opacity: 0.95,
    });
  }

  if (isBig) {
    const sparklePoints: Array<[number, number]> =
      frame === 0
        ? [
            [10, 12],
            [90, 15],
            [8, 85],
            [92, 82],
          ]
        : [
            [8, 22],
            [92, 24],
            [12, 75],
            [88, 90],
          ];
    for (const [x, y] of sparklePoints) {
      shapes.push({ kind: 'path', d: starPath(x, y, 3.2), fill: palette.sparkle, opacity: 0.95 });
    }
  }
}

function pushWings(
  shapes: MascotShape[],
  palette: Palette,
  centerX: number,
  bodyCenterY: number,
  bodyHalfWidth: number,
  scale: number,
  lift: number,
  outlineWidth: number,
): void {
  void outlineWidth;
  for (const direction of [-1, 1]) {
    const originX = centerX + direction * (bodyHalfWidth - 3);
    const originY = bodyCenterY - 8 * scale + lift;
    shapes.push({
      kind: 'path',
      d: leafPath(originX, originY, direction, 24 * scale, 10.5 * scale),
      fill: palette.accessoryDark,
      stroked: true,
    });
    shapes.push({
      kind: 'path',
      d: leafPath(originX, originY - 2, direction, 15 * scale, 5.6 * scale),
      fill: palette.accessory,
    });
  }
}

function pushTail(
  shapes: MascotShape[],
  palette: Palette,
  style: TailStyle,
  tailX: number,
  bodyCenterY: number,
  scale: number,
  frame: number,
  outlineWidth: number,
): void {
  void outlineWidth;
  const wag = frame === 1 ? -1 : 1;
  switch (style) {
    case 'long':
      shapes.push({
        kind: 'path',
        d: leafPath(tailX, bodyCenterY, wag, 22 * scale, 5 * scale),
        fill: palette.shade,
        stroked: true,
      });
      shapes.push({ kind: 'ellipse', cx: tailX + wag * 20 * scale, cy: bodyCenterY - 12 * scale, rx: 4 * scale, ry: 4 * scale, fill: palette.light });
      break;
    case 'stubby':
      shapes.push({ kind: 'ellipse', cx: tailX + 3 * scale, cy: bodyCenterY + 3 * wag * scale, rx: 5 * scale, ry: 6 * scale, fill: palette.shade, stroked: true });
      break;
    case 'puff':
      shapes.push({ kind: 'circle', cx: tailX + 5 * scale, cy: bodyCenterY + 3 * scale, r: 7 * scale, fill: palette.light, stroked: true });
      shapes.push({ kind: 'circle', cx: tailX + 5 * scale, cy: bodyCenterY + 3 * scale, r: 4.2 * scale, fill: palette.base });
      break;
    case 'tiny':
      shapes.push({ kind: 'circle', cx: tailX + 2.4 * scale, cy: bodyCenterY + 5 * scale, r: 3.4 * scale, fill: palette.shade, stroked: true });
      break;
    case 'spiky':
      for (let step = 0; step < 5; step += 1) {
        const size = (4.6 - step * 0.6) * scale;
        shapes.push({
          kind: 'path',
          d: leafPath(tailX + (4 + step * 3.2) * scale, bodyCenterY + (2 + step * 2.6) * scale, 1, size * 1.8, size),
          fill: step % 2 === 0 ? palette.base : palette.accessoryDark,
          stroked: true,
        });
      }
      break;
    case 'none':
    default:
      break;
  }
}
