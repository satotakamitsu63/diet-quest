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
  /** body/head の塗りに使うグラデーションの id */
  bodyGradientId: string;
};

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, ratio));
}

type EarStyle = 'pointed' | 'floppy' | 'tall' | 'round' | 'none' | 'horns';
type MuzzleStyle = 'small' | 'long' | 'beak';
type TailStyle = 'long' | 'stubby' | 'puff' | 'tiny' | 'none' | 'spiky';

type SpeciesTraits = {
  ears: EarStyle;
  muzzle: MuzzleStyle;
  tail: TailStyle;
  hasWhiskers: boolean;
  hasBellyPatch: boolean;
  hasWings: boolean;
};

const SPECIES_TRAITS: Record<CharacterSpecies, SpeciesTraits> = {
  cat: { ears: 'pointed', muzzle: 'small', tail: 'long', hasWhiskers: true, hasBellyPatch: false, hasWings: false },
  dog: { ears: 'floppy', muzzle: 'long', tail: 'stubby', hasWhiskers: false, hasBellyPatch: false, hasWings: false },
  rabbit: { ears: 'tall', muzzle: 'small', tail: 'puff', hasWhiskers: true, hasBellyPatch: false, hasWings: false },
  bear: { ears: 'round', muzzle: 'long', tail: 'tiny', hasWhiskers: false, hasBellyPatch: false, hasWings: false },
  penguin: { ears: 'none', muzzle: 'beak', tail: 'none', hasWhiskers: false, hasBellyPatch: true, hasWings: false },
  dragon: { ears: 'horns', muzzle: 'long', tail: 'spiky', hasWhiskers: false, hasBellyPatch: false, hasWings: true },
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
  { scale: 1.24, coatMix: 0.96, eyes: 'hero', mouth: 'grin', blush: true, accessory: 'crownGem', aura: 'burstSmall', bonusWings: false },
  { scale: 1.32, coatMix: 1.0, eyes: 'hero', mouth: 'grin', blush: true, accessory: 'crownGem', aura: 'burstBig', bonusWings: true },
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

function teardropPath(originX: number, originY: number, dirX: number, length: number, width: number): string {
  const tipX = originX + dirX * length;
  const tipY = originY - length * 0.35;
  const c1x = originX + dirX * length * 0.35;
  const c1y = originY - width;
  const c2x = originX + dirX * length * 0.8;
  const c2y = originY - width * 0.5;
  const c3x = originX + dirX * length * 0.55;
  const c3y = originY + width * 0.55;
  return `M${originX.toFixed(1)},${originY.toFixed(1)} Q${c1x.toFixed(1)},${c1y.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} Q${c2x.toFixed(1)},${c2y.toFixed(1)} ${c3x.toFixed(1)},${c3y.toFixed(1)} L${originX.toFixed(1)},${originY.toFixed(1)} Z`;
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

  const bodyHalfWidth = lerp(13, 31, shapeValue) * 0.86 * scale;
  const bodyRadiusY = lerp(16, 21.5, shapeValue) * scale;
  const bodyCenterY = BODY_CENTER_Y + bounce;

  const headRadiusX = lerp(24, 29, shapeValue * 0.35) * scale;
  const headRadiusY = lerp(23, 27, shapeValue * 0.3) * scale;
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
    pushWings(shapes, palette, CENTER_X, bodyCenterY, bodyHalfWidth, scale, bounce);
  }

  // ---- 尻尾 ----
  pushTail(shapes, palette, traits.tail, CENTER_X + bodyHalfWidth, bodyCenterY, scale, frame);

  // ---- 足 ----
  const footRadius = lerp(4.2, 7, shapeValue) * scale;
  const footY = bodyCenterY + bodyRadiusY - footRadius * 0.5;
  shapes.push(
    { kind: 'ellipse', cx: CENTER_X - bodyHalfWidth * 0.55, cy: footY, rx: footRadius, ry: footRadius * 0.72, fill: palette.shade, stroked: true },
    { kind: 'ellipse', cx: CENTER_X + bodyHalfWidth * 0.55, cy: footY, rx: footRadius, ry: footRadius * 0.72, fill: palette.shade, stroked: true },
  );

  // ---- 胴 ----
  shapes.push({
    kind: 'ellipse',
    cx: CENTER_X,
    cy: bodyCenterY,
    rx: bodyHalfWidth,
    ry: bodyRadiusY,
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

  if (traits.hasBellyPatch) {
    shapes.push({
      kind: 'ellipse',
      cx: CENTER_X,
      cy: bodyCenterY + bodyRadiusY * 0.1,
      rx: bodyHalfWidth * 0.72,
      ry: bodyRadiusY * 0.85,
      fill: palette.light,
    });
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: CENTER_X + direction * (bodyHalfWidth - 1),
        cy: bodyCenterY,
        rx: 4.4 * scale,
        ry: 11 * scale,
        fill: palette.shade,
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
  pushEars(shapes, palette, traits.ears, CENTER_X, headRadiusX, headCenterY, headRadiusY, droop, scale);

  // ---- 頭 ----
  shapes.push({
    kind: 'ellipse',
    cx: CENTER_X,
    cy: headCenterY,
    rx: headRadiusX,
    ry: headRadiusY,
    fill: `url(#${bodyGradientId})`,
    stroked: true,
  });

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

  // つやハイライト。トイのような光沢
  shapes.push({
    kind: 'ellipse',
    cx: CENTER_X - headRadiusX * 0.42,
    cy: headCenterY - headRadiusY * 0.52,
    rx: headRadiusX * 0.34,
    ry: headRadiusY * 0.22,
    fill: '#ffffff',
    opacity: 0.55,
    rotate: -20,
  });

  const eyeSpread = headRadiusX * 0.44;
  const eyeY = headCenterY - headRadiusY * 0.02;
  if (effectiveEyes === 'x') {
    pushExhaustedEyes(shapes, palette, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale);
  } else {
    pushEyes(shapes, palette, effectiveEyes, CENTER_X - eyeSpread, CENTER_X + eyeSpread, eyeY, scale);
  }

  const muzzleY = headCenterY + headRadiusY * 0.46;
  pushMuzzle(shapes, palette, traits.muzzle, traits.hasWhiskers, CENTER_X, muzzleY, scale);
  pushMouth(shapes, palette, effectiveMouth, species, CENTER_X, muzzleY + headRadiusY * 0.24, scale);

  // ---- 首まわりの飾り。あごのすぐ下、頭の前面に乗せる ----
  pushNeckwear(shapes, palette, stageLook.accessory, CENTER_X, headCenterY + headRadiusY * 1.04, bodyHalfWidth, scale);

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
      shapes.push({ kind: 'ellipse', cx: x, cy: y, rx: radius, ry: radius * 0.7, fill: palette.deepShade, opacity: 0.8 });
    }
    const tufts: Array<[number, number, number]> = [
      [CENTER_X - headRadiusX - 1, headCenterY - headRadiusY + 3, -30],
      [CENTER_X + headRadiusX + 1, headCenterY - headRadiusY + 6, 25],
      [CENTER_X + 6, headCenterY - headRadiusY - 2, -12],
    ];
    for (const [x, y, angle] of tufts) {
      shapes.push({ kind: 'path', d: teardropPath(x, y, angle > 0 ? 1 : -1, 6, 1.6), fill: palette.deepShade });
    }
  }

  const earsRiseUp = traits.ears === 'pointed' || traits.ears === 'tall';
  const crownBaseY = headCenterY - headRadiusY - (earsRiseUp ? 12 : 5) * scale + droop * 2;
  pushCrown(shapes, palette, stageLook.accessory, CENTER_X, crownBaseY, scale);

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
    outlineWidth: 2.1,
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
): void {
  const headTop = headCenterY - headRadiusY;
  const leftX = headCenterX - headRadiusX * 0.6;
  const rightX = headCenterX + headRadiusX * 0.6;

  if (style === 'pointed') {
    const apexY = headTop + 4 * scale + droop * 4;
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'path', d: teardropPath(x, apexY, dir, 15 * scale, 6.5 * scale), fill: palette.base, stroked: true });
      shapes.push({ kind: 'path', d: teardropPath(x, apexY - 1, dir, 9 * scale, 3.4 * scale), fill: palette.nose });
    }
    return;
  }

  if (style === 'floppy') {
    const earTop = headTop + 8 * scale + droop * 3;
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'ellipse',
        cx: headCenterX + direction * (headRadiusX + 2),
        cy: earTop + 12 * scale,
        rx: 8 * scale,
        ry: 15 * scale,
        fill: palette.shade,
        stroked: true,
        rotate: direction * 12,
      });
      shapes.push({
        kind: 'ellipse',
        cx: headCenterX + direction * (headRadiusX + 2),
        cy: earTop + 12 * scale,
        rx: 4 * scale,
        ry: 10 * scale,
        fill: palette.deepShade,
        rotate: direction * 12,
      });
    }
    return;
  }

  if (style === 'tall') {
    const lean = droop * 5;
    const earHeight = 24 * scale;
    for (const direction of [-1, 1]) {
      const baseX = headCenterX + direction * 8 * scale;
      shapes.push({
        kind: 'ellipse',
        cx: baseX + direction * lean * 0.4,
        cy: headTop - earHeight * 0.42,
        rx: 4.4 * scale,
        ry: earHeight * 0.55,
        fill: palette.base,
        stroked: true,
        rotate: direction * (6 + lean),
      });
      shapes.push({
        kind: 'ellipse',
        cx: baseX + direction * lean * 0.4,
        cy: headTop - earHeight * 0.4,
        rx: 2 * scale,
        ry: earHeight * 0.4,
        fill: palette.nose,
        rotate: direction * (6 + lean),
      });
    }
    return;
  }

  if (style === 'round') {
    for (const [x, dir] of [[leftX, -1] as const, [rightX, 1] as const]) {
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: 8 * scale, fill: palette.base, stroked: true });
      shapes.push({ kind: 'circle', cx: x + dir * 2, cy: headTop + 5 * scale, r: 3.6 * scale, fill: palette.nose });
    }
    return;
  }

  if (style === 'horns') {
    for (const direction of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: teardropPath(headCenterX + direction * 9 * scale, headTop + 4 * scale, direction, 13 * scale, 3.6 * scale),
        fill: palette.accessoryDark,
        stroked: true,
      });
    }
  }
}

function pushEyes(
  shapes: MascotShape[],
  palette: Palette,
  style: EyeStyle,
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
  scale: number,
): void {
  if (style === 'droopy') {
    for (const eyeX of [leftEyeX, rightEyeX]) {
      shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY + 1.5, rx: 5.6 * scale, ry: 2.6 * scale, fill: palette.eyeDark, opacity: 0.85 });
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - 5.6 * scale).toFixed(1)},${eyeY.toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 3 * scale).toFixed(1)} ${(eyeX + 5.6 * scale).toFixed(1)},${eyeY.toFixed(1)} L${(eyeX + 5.6 * scale).toFixed(1)},${(eyeY + 1.2).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 1.2 * scale).toFixed(1)} ${(eyeX - 5.6 * scale).toFixed(1)},${(eyeY + 1.2).toFixed(1)} Z`,
        fill: palette.outline,
      });
      shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY + 8.2 * scale, rx: 5.2 * scale, ry: 2.4 * scale, fill: palette.deepShade, opacity: 0.55 });
    }
    return;
  }

  if (style === 'hero') {
    for (const eyeX of [leftEyeX, rightEyeX]) {
      const direction = eyeX < CENTER_X ? -1 : 1;
      shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx: 6.8 * scale, ry: 4.8 * scale, fill: palette.eyeDark, stroked: true, rotate: -direction * 8 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 1, cy: eyeY, rx: 5.4 * scale, ry: 3.7 * scale, fill: palette.eye, rotate: -direction * 8 });
      shapes.push({ kind: 'ellipse', cx: eyeX + direction * 2.4, cy: eyeY - 1, rx: 1.6 * scale, ry: 2.3 * scale, fill: palette.eyeHighlight });
      shapes.push({
        kind: 'path',
        d: `M${(eyeX - 6.4 * scale).toFixed(1)},${(eyeY - 7.5 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 10.5 * scale).toFixed(1)} ${(eyeX + 6.4 * scale).toFixed(1)},${(eyeY - 6.5 * scale).toFixed(1)} L${(eyeX + 6 * scale).toFixed(1)},${(eyeY - 4.6 * scale).toFixed(1)} Q${eyeX.toFixed(1)},${(eyeY - 8.2 * scale).toFixed(1)} ${(eyeX - 6 * scale).toFixed(1)},${(eyeY - 5.6 * scale).toFixed(1)} Z`,
        fill: palette.deepShade,
      });
    }
    return;
  }

  const radius = style === 'sparkle' ? 8.4 * scale : 7.1 * scale;
  for (const eyeX of [leftEyeX, rightEyeX]) {
    shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY, rx: radius, ry: radius * 1.14, fill: palette.eyeDark, stroked: true });
    shapes.push({ kind: 'ellipse', cx: eyeX, cy: eyeY + radius * 0.14, rx: radius * 0.76, ry: radius * 0.86, fill: palette.eye });
    shapes.push({ kind: 'ellipse', cx: eyeX - radius * 0.3, cy: eyeY - radius * 0.36, rx: radius * 0.4, ry: radius * 0.46, fill: palette.eyeHighlight });
    if (style === 'sparkle') {
      shapes.push({ kind: 'ellipse', cx: eyeX + radius * 0.4, cy: eyeY + radius * 0.3, rx: radius * 0.16, ry: radius * 0.18, fill: palette.eyeHighlight });
      shapes.push({ kind: 'ellipse', cx: eyeX - radius * 0.05, cy: eyeY + radius * 0.55, rx: radius * 0.12, ry: radius * 0.12, fill: palette.eyeHighlight, opacity: 0.8 });
    }
  }
}

function pushExhaustedEyes(
  shapes: MascotShape[],
  palette: Palette,
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
  scale: number,
): void {
  const half = 5.4 * scale;
  for (const eyeX of [leftEyeX, rightEyeX]) {
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY - half, x2: eyeX + half, y2: eyeY + half, stroke: palette.outline, width: 2.4 * scale });
    shapes.push({ kind: 'line', x1: eyeX - half, y1: eyeY + half, x2: eyeX + half, y2: eyeY - half, stroke: palette.outline, width: 2.4 * scale });
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
    shapes.push({ kind: 'line', x1: centerX - 6.2 * scale, y1: mouthY + 2.2 * scale, x2: centerX, y2: mouthY - 2.4 * scale, stroke: palette.outline, width: 2.3 * scale });
    shapes.push({ kind: 'line', x1: centerX + 6.2 * scale, y1: mouthY + 2.2 * scale, x2: centerX, y2: mouthY - 2.4 * scale, stroke: palette.outline, width: 2.3 * scale });
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
  shapes.push({
    kind: 'line',
    x1: centerX - 6 * scale,
    y1: mouthY - 2.2 * scale,
    x2: centerX,
    y2: mouthY + 0.4 * scale,
    stroke: palette.outline,
    width: 2.2 * scale,
  });
  shapes.push({
    kind: 'line',
    x1: centerX,
    y1: mouthY + 0.4 * scale,
    x2: centerX + 6 * scale,
    y2: mouthY - 2.2 * scale,
    stroke: palette.outline,
    width: 2.2 * scale,
  });
}

function pushMuzzle(
  shapes: MascotShape[],
  palette: Palette,
  style: MuzzleStyle,
  hasWhiskers: boolean,
  centerX: number,
  muzzleY: number,
  scale: number,
): void {
  if (style === 'beak') {
    shapes.push({
      kind: 'path',
      d: `M${(centerX - 6 * scale).toFixed(1)},${(muzzleY - 2 * scale).toFixed(1)} Q${centerX.toFixed(1)},${(muzzleY + 4 * scale).toFixed(1)} ${(centerX + 6 * scale).toFixed(1)},${(muzzleY - 2 * scale).toFixed(1)} Q${centerX.toFixed(1)},${(muzzleY - 1 * scale).toFixed(1)} ${(centerX - 6 * scale).toFixed(1)},${(muzzleY - 2 * scale).toFixed(1)} Z`,
      fill: palette.nose,
      stroked: true,
    });
    return;
  }

  if (style === 'long') {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 3.4 * scale, rx: 10 * scale, ry: 6.6 * scale, fill: palette.light, stroked: true });
  } else {
    shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 1.6 * scale, rx: 6.8 * scale, ry: 4.6 * scale, fill: palette.light });
  }
  shapes.push({ kind: 'ellipse', cx: centerX, cy: muzzleY + 0.4 * scale, rx: 2.3 * scale, ry: 1.7 * scale, fill: palette.nose, stroked: true });

  if (hasWhiskers) {
    for (const direction of [-1, 1]) {
      for (const offset of [-2.2, 0, 2.2]) {
        shapes.push({
          kind: 'line',
          x1: centerX + direction * 8 * scale,
          y1: muzzleY + offset * scale,
          x2: centerX + direction * 15 * scale,
          y2: muzzleY + offset * 1.6 * scale,
          stroke: palette.outline,
          width: 0.8 * scale,
          opacity: 0.7,
        });
      }
    }
  }
}

/** えり・リボンなど、首まわりの飾り。頭より先に描き、あごの下から覗く自然な位置にする。 */
function pushNeckwear(
  shapes: MascotShape[],
  palette: Palette,
  style: AccessoryStyle,
  centerX: number,
  neckY: number,
  bodyHalfWidth: number,
  scale: number,
): void {
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

/** かんむり。頭より後に描き、いちばん手前にのせる。 */
function pushCrown(
  shapes: MascotShape[],
  palette: Palette,
  style: AccessoryStyle,
  centerX: number,
  crownBaseY: number,
  scale: number,
): void {
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
): void {
  for (const direction of [-1, 1]) {
    const originX = centerX + direction * (bodyHalfWidth - 3);
    const originY = bodyCenterY - 8 * scale + lift;
    shapes.push({
      kind: 'path',
      d: teardropPath(originX, originY, direction, 24 * scale, 11 * scale),
      fill: palette.accessoryDark,
      stroked: true,
    });
    shapes.push({
      kind: 'path',
      d: teardropPath(originX, originY - 2, direction, 15 * scale, 6 * scale),
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
): void {
  const wag = frame === 1 ? -1 : 1;
  switch (style) {
    case 'long':
      shapes.push({
        kind: 'path',
        d: teardropPath(tailX, bodyCenterY, wag, 22 * scale, 5.4 * scale),
        fill: palette.shade,
        stroked: true,
      });
      shapes.push({ kind: 'ellipse', cx: tailX + wag * 20 * scale, cy: bodyCenterY - 12 * scale, rx: 4.2 * scale, ry: 4.2 * scale, fill: palette.light });
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
          d: teardropPath(tailX + (4 + step * 3.2) * scale, bodyCenterY + (2 + step * 2.6) * scale, 1, size * 1.8, size),
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
