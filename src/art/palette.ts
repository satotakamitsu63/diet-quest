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

/**
 * 姿（幼体・中間形態・最終形態）ごとの、育ちきったときの毛色。
 * 幼体から最終形態への切り替えは色を混ぜるのではなく瞬間的に入れ替わる
 * （進化として、じわじわ色が変わるのではなく一気に姿が変わるほうが
 * 「見違えた」感が出るため）。育つ前のくすんだ色は、同じ色相のまま
 * 彩度と明度だけを落として作るので、色相をまたいで混ぜる必要がない。
 */
export type FormPalette = {
  hue: number;
  saturation: number;
  lightness: number;
  accessoryHue: number;
  eyeHue: number;
};

export type PaletteInput = {
  form: FormPalette;
  /** 0（育つ前のこの姿）〜1（育ちきったこの姿）。姿の中だけで変化する */
  coatMix: number;
  condition: CharacterCondition;
};

export function buildPalette(input: PaletteInput): Palette {
  const mixRatio = Math.min(1, Math.max(0, input.coatMix));
  const { form } = input;

  // 育つ前は同じ色相のまま彩度・明度を落とす。色相をまたがないので
  // 「途中で無関係な色を経由する」問題が起きない
  const dullSaturation = Math.max(8, form.saturation * 0.22);
  const dullLightness = form.lightness < 40 ? form.lightness + 14 : form.lightness * 0.72;
  const saturation = dullSaturation + (form.saturation - dullSaturation) * mixRatio;
  const lightness = dullLightness + (form.lightness - dullLightness) * mixRatio;

  // やつれているときは彩度と明度を落として、見た目にすぐ分かるようにする
  const fatigue = input.condition === 'exhausted' ? 0.5 : input.condition === 'tired' ? 0.2 : 0;
  const adjusted: Hsl = {
    hue: form.hue,
    saturation: saturation * (1 - fatigue),
    lightness: lightness * (1 - fatigue * 0.22),
  };

  const eyeLightness = 30 + mixRatio * 8;

  return {
    base: toHex(adjusted),
    shade: toHex({ ...adjusted, lightness: adjusted.lightness - 15 }),
    deepShade: toHex({ ...adjusted, saturation: adjusted.saturation + 6, lightness: adjusted.lightness - 27 }),
    light: toHex({ ...adjusted, lightness: Math.min(96, adjusted.lightness + 15) }),
    gloss: toHex({ hue: adjusted.hue, saturation: Math.max(10, adjusted.saturation - 40), lightness: Math.min(99, adjusted.lightness + 30) }),
    outline: toHex({ hue: adjusted.hue, saturation: 30, lightness: 14 + mixRatio * 4 }),
    eye: toHex({ hue: form.eyeHue, saturation: 42 + mixRatio * 40, lightness: eyeLightness }),
    eyeDark: toHex({ hue: form.eyeHue, saturation: 55, lightness: 15 }),
    eyeHighlight: '#ffffff',
    nose: toHex({ hue: 350, saturation: 55 + mixRatio * 25, lightness: 58 + mixRatio * 8 }),
    blush: toHex({ hue: 350, saturation: 78, lightness: 76 }),
    accessory: toHex({ hue: form.accessoryHue, saturation: 68, lightness: 60 }),
    accessoryDark: toHex({ hue: form.accessoryHue, saturation: 64, lightness: 42 }),
    gem: toHex({ hue: form.accessoryHue + 160, saturation: 85, lightness: 62 }),
    sparkle: '#fff8d6',
    aura: toHex({ hue: form.accessoryHue + 160, saturation: 85, lightness: 74 }),
    auraCore: toHex({ hue: form.accessoryHue + 160, saturation: 90, lightness: 88 }),
    flame: toHex({ hue: form.accessoryHue + 135, saturation: 92, lightness: 66 }),
  };
}
