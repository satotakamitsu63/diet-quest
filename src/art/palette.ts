import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';

export type Palette = {
  base: string;
  shade: string;
  light: string;
  outline: string;
  eye: string;
  eyeHighlight: string;
  nose: string;
  blush: string;
  accessory: string;
  accessoryDark: string;
  sparkle: string;
  aura: string;
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
  return {
    hue: from.hue + (to.hue - from.hue) * ratio,
    saturation: from.saturation + (to.saturation - from.saturation) * ratio,
    lightness: from.lightness + (to.lightness - from.lightness) * ratio,
  };
}

/** 段階0は毛づやのないくすんだ灰茶。段階が上がるほど本来の毛色に近づく。 */
const DULL_COAT: Hsl = { hue: 28, saturation: 9, lightness: 36 };

const FINAL_COAT: Record<CharacterSpecies, Hsl> = {
  cat: { hue: 38, saturation: 64, lightness: 71 },
  dog: { hue: 24, saturation: 58, lightness: 60 },
};

const ACCESSORY_HUE: Record<CharacterSpecies, number> = { cat: 340, dog: 200 };

export type PaletteInput = {
  species: CharacterSpecies;
  /** 0〜9 */
  growthStage: number;
  condition: CharacterCondition;
};

export function buildPalette(input: PaletteInput): Palette {
  const progress = Math.min(1, Math.max(0, input.growthStage / 9));
  const coat = mix(DULL_COAT, FINAL_COAT[input.species], progress);

  // やつれているときは彩度と明度を落として、見た目にすぐ分かるようにする
  const fatigue = input.condition === 'exhausted' ? 0.45 : input.condition === 'tired' ? 0.18 : 0;
  const adjusted: Hsl = {
    hue: coat.hue,
    saturation: coat.saturation * (1 - fatigue),
    lightness: coat.lightness * (1 - fatigue * 0.25),
  };

  const eyeLightness = 22 + progress * 12;
  const accessoryHue = ACCESSORY_HUE[input.species];

  return {
    base: toHex(adjusted),
    shade: toHex({ ...adjusted, lightness: adjusted.lightness - 14 }),
    light: toHex({ ...adjusted, lightness: Math.min(94, adjusted.lightness + 16) }),
    outline: toHex({ hue: adjusted.hue, saturation: 22, lightness: 16 + progress * 6 }),
    eye: toHex({ hue: 205 - progress * 40, saturation: 20 + progress * 55, lightness: eyeLightness }),
    eyeHighlight: '#ffffff',
    nose: toHex({ hue: 348, saturation: 30 + progress * 30, lightness: 52 + progress * 10 }),
    blush: toHex({ hue: 350, saturation: 70, lightness: 74 }),
    accessory: toHex({ hue: accessoryHue, saturation: 62, lightness: 58 }),
    accessoryDark: toHex({ hue: accessoryHue, saturation: 58, lightness: 40 }),
    sparkle: '#fff6c9',
    aura: toHex({ hue: accessoryHue + 20, saturation: 80, lightness: 72 }),
  };
}
