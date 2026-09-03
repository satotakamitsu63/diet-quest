import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';

export type Palette = {
  base: string;
  shade: string;
  deepShade: string;
  light: string;
  gloss: string;
  outline: string;
  eye: string;
  eyeDark: string;
  eyeHighlight: string;
  nose: string;
  blush: string;
  accessory: string;
  accessoryDark: string;
  gem: string;
  sparkle: string;
  aura: string;
  auraCore: string;
  flame: string;
};

type Hsl = { hue: number; saturation: number; lightness: number };

function toHex(hsl: Hsl): string {
  const hue = ((hsl.hue % 360) + 360) % 360;
  const saturation = Math.min(100, Math.max(0, hsl.saturation)) / 100;
  const lightness = Math.min(100, Math.max(0, hsl.lightness)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const sextant = Math.floor(hue / 60) % 6;
  const rgbBySextant: Array<[number, number, number]> = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];
  const [red, green, blue] = rgbBySextant[sextant];
  const channel = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function mix(from: Hsl, to: Hsl, ratio: number): Hsl {
  const t = Math.min(1, Math.max(0, ratio));
  // 色相は360度の輪なので、そのまま引き算すると遠回りする経路を通ることがある
  // （例：橙32°→濃紺216°を直線で混ぜると、途中で無関係な緑を通ってしまう）。
  // 差を±180度に折り返して、必ず近いほうの経路で混ぜる
  let hueDiff = to.hue - from.hue;
  hueDiff = ((hueDiff + 180) % 360 + 360) % 360 - 180;
  return {
    hue: from.hue + hueDiff * t,
    saturation: from.saturation + (to.saturation - from.saturation) * t,
    lightness: from.lightness + (to.lightness - from.lightness) * t,
  };
}

/** 育つ前のくすんだ毛色。彩度が低く、灰色がかっている。 */
const DULL_COAT: Hsl = { hue: 32, saturation: 12, lightness: 40 };

/**
 * 育ちきったときの毛色。実際の動物の毛色・体色に寄せつつ、
 * トイのようにはっきりした彩度で「かわいい・かっこいい」を出す。
 */
const FINAL_COAT: Record<CharacterSpecies, Hsl> = {
  cat: { hue: 30, saturation: 68, lightness: 64 }, // 茶トラのような、あたたかい橙色
  dog: { hue: 32, saturation: 58, lightness: 56 }, // ゴールデン系の、やわらかい黄褐色
  rabbit: { hue: 34, saturation: 20, lightness: 86 }, // クリーム〜グレージュ。ピンクにはしない
  bear: { hue: 22, saturation: 52, lightness: 40 }, // 深みのある、しっかりした茶色
  penguin: { hue: 216, saturation: 34, lightness: 15 }, // ほぼ黒に近い、青みがかった濃紺
  dragon: { hue: 148, saturation: 62, lightness: 42 }, // 深みのあるエメラルドグリーン
};

/** 最終段階だけにのせる特別な輝き色。金属っぽい艶を出す。 */
const LEGEND_TINT: Record<CharacterSpecies, Hsl> = {
  cat: { hue: 40, saturation: 88, lightness: 72 },
  dog: { hue: 38, saturation: 82, lightness: 66 },
  rabbit: { hue: 40, saturation: 55, lightness: 92 },
  bear: { hue: 34, saturation: 76, lightness: 54 },
  penguin: { hue: 200, saturation: 70, lightness: 48 },
  dragon: { hue: 158, saturation: 82, lightness: 56 },
};

/**
 * 目の色相。種族ごとに固定し、色そのものでも見分けがつくようにする。
 * ねこ＝グリーンアンバー、いぬ＝あたたかい茶、うさぎ＝赤み寄りの茶、
 * くま＝ダークブラウン、ぺんぎん＝黒に近い紺、ドラゴン＝金色。
 */
const EYE_HUE: Record<CharacterSpecies, number> = {
  cat: 96,
  dog: 26,
  rabbit: 14,
  bear: 20,
  penguin: 214,
  dragon: 44,
};

const ACCESSORY_HUE: Record<CharacterSpecies, number> = {
  cat: 340,
  dog: 205,
  rabbit: 280,
  bear: 42,
  penguin: 20,
  dragon: 52,
};

/** アクセサリーの宝石や後光に使う、種族ごとの輝き色。 */
const AURA_HUE: Record<CharacterSpecies, number> = {
  cat: 335,
  dog: 40,
  rabbit: 300,
  bear: 45,
  penguin: 195,
  dragon: 145,
};

export type PaletteInput = {
  species: CharacterSpecies;
  /** 0（育つ前）〜1（完全に育った）。段階ごとに大きくジャンプしてよい */
  coatMix: number;
  condition: CharacterCondition;
};

export function buildPalette(input: PaletteInput): Palette {
  const mixRatio = Math.min(1, Math.max(0, input.coatMix));
  let coat = mix(DULL_COAT, FINAL_COAT[input.species], mixRatio);

  // 最終段階の手前からは、通常の配色を超えて特別な輝きを混ぜる
  if (mixRatio > 0.9) {
    const legendRatio = (mixRatio - 0.9) / 0.1;
    coat = mix(coat, LEGEND_TINT[input.species], legendRatio * 0.6);
  }

  // やつれているときは彩度と明度を落として、見た目にすぐ分かるようにする
  const fatigue =
    input.condition === 'exhausted' ? 0.5 : input.condition === 'tired' ? 0.2 : 0;
  const adjusted: Hsl = {
    hue: coat.hue,
    saturation: coat.saturation * (1 - fatigue),
    lightness: coat.lightness * (1 - fatigue * 0.22),
  };

  const eyeLightness = 30 + mixRatio * 8;
  const eyeHue = EYE_HUE[input.species];
  const accessoryHue = ACCESSORY_HUE[input.species];
  const auraHue = AURA_HUE[input.species];

  return {
    base: toHex(adjusted),
    shade: toHex({ ...adjusted, lightness: adjusted.lightness - 15 }),
    deepShade: toHex({ ...adjusted, saturation: adjusted.saturation + 6, lightness: adjusted.lightness - 27 }),
    light: toHex({ ...adjusted, lightness: Math.min(96, adjusted.lightness + 15) }),
    gloss: toHex({ hue: adjusted.hue, saturation: Math.max(10, adjusted.saturation - 40), lightness: Math.min(99, adjusted.lightness + 30) }),
    outline: toHex({ hue: adjusted.hue, saturation: 30, lightness: 14 + mixRatio * 4 }),
    // 目の色は種族ごとに固定した色相を使う。黒目（瞳孔）は小さく、瞳の色そのものを主役にする
    eye: toHex({ hue: eyeHue, saturation: 42 + mixRatio * 40, lightness: eyeLightness }),
    eyeDark: toHex({ hue: eyeHue, saturation: 55, lightness: 15 }),
    eyeHighlight: '#ffffff',
    nose: toHex({ hue: 350, saturation: 55 + mixRatio * 25, lightness: 58 + mixRatio * 8 }),
    blush: toHex({ hue: 350, saturation: 78, lightness: 76 }),
    accessory: toHex({ hue: accessoryHue, saturation: 68, lightness: 60 }),
    accessoryDark: toHex({ hue: accessoryHue, saturation: 64, lightness: 42 }),
    gem: toHex({ hue: auraHue, saturation: 85, lightness: 62 }),
    sparkle: '#fff8d6',
    aura: toHex({ hue: auraHue, saturation: 85, lightness: 74 }),
    auraCore: toHex({ hue: auraHue, saturation: 90, lightness: 88 }),
    flame: toHex({ hue: auraHue - 25, saturation: 92, lightness: 66 }),
  };
}
