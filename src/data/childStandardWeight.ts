import type { Sex } from './dietaryReference';

/**
 * 日本小児内分泌学会の性別・年齢別・身長別標準体重の係数。
 * 標準体重(kg) = a × 身長(cm) - b
 * 肥満度(%) = (実測体重 - 標準体重) / 標準体重 × 100
 * 適用範囲は5〜17歳。5歳未満はこの式を使わず、栄養の充足だけを見る。
 */
type Coefficient = { a: number; b: number };

const MALE_COEFFICIENTS: Record<number, Coefficient> = {
  5: { a: 0.386, b: 23.699 },
  6: { a: 0.461, b: 32.382 },
  7: { a: 0.513, b: 38.878 },
  8: { a: 0.592, b: 48.804 },
  9: { a: 0.687, b: 61.390 },
  10: { a: 0.752, b: 70.461 },
  11: { a: 0.782, b: 75.106 },
  12: { a: 0.783, b: 75.642 },
  13: { a: 0.815, b: 81.348 },
  14: { a: 0.832, b: 83.695 },
  15: { a: 0.766, b: 70.989 },
  16: { a: 0.656, b: 51.822 },
  17: { a: 0.672, b: 53.642 },
};

const FEMALE_COEFFICIENTS: Record<number, Coefficient> = {
  5: { a: 0.377, b: 22.750 },
  6: { a: 0.458, b: 32.079 },
  7: { a: 0.508, b: 38.367 },
  8: { a: 0.561, b: 45.006 },
  9: { a: 0.652, b: 56.992 },
  10: { a: 0.730, b: 68.091 },
  11: { a: 0.803, b: 78.846 },
  12: { a: 0.796, b: 76.934 },
  13: { a: 0.655, b: 54.234 },
  14: { a: 0.594, b: 43.264 },
  15: { a: 0.560, b: 37.002 },
  16: { a: 0.578, b: 39.057 },
  17: { a: 0.598, b: 42.339 },
};

export const CHILD_STANDARD_WEIGHT_MIN_AGE = 5;
export const CHILD_STANDARD_WEIGHT_MAX_AGE = 17;

/** 身長から学童の標準体重(kg)を求める。適用外の年齢では null を返す。 */
export function calculateChildStandardWeight(
  age: number,
  sex: Sex,
  heightCm: number,
): number | null {
  if (age < CHILD_STANDARD_WEIGHT_MIN_AGE || age > CHILD_STANDARD_WEIGHT_MAX_AGE) return null;
  const table = sex === 'male' ? MALE_COEFFICIENTS : FEMALE_COEFFICIENTS;
  const coefficient = table[Math.floor(age)];
  if (!coefficient) return null;
  const weight = coefficient.a * heightCm - coefficient.b;
  return weight > 0 ? Math.round(weight * 10) / 10 : null;
}

export type ObesityCategory =
  | 'severelyUnderweight'
  | 'underweight'
  | 'normal'
  | 'mildObesity'
  | 'moderateObesity'
  | 'severeObesity';

export const OBESITY_CATEGORY_LABELS: Record<ObesityCategory, string> = {
  severelyUnderweight: 'やせすぎ',
  underweight: 'やせぎみ',
  normal: 'ふつう',
  mildObesity: '軽度肥満',
  moderateObesity: '中等度肥満',
  severeObesity: '高度肥満',
};

/** 肥満度(%)から学童の判定区分を返す。 */
export function classifyObesityRate(obesityRate: number): ObesityCategory {
  if (obesityRate < -30) return 'severelyUnderweight';
  if (obesityRate < -20) return 'underweight';
  if (obesityRate < 20) return 'normal';
  if (obesityRate < 30) return 'mildObesity';
  if (obesityRate < 50) return 'moderateObesity';
  return 'severeObesity';
}

export const CHILD_STANDARD_SOURCE = '日本小児内分泌学会 性別・年齢別・身長別標準体重';
