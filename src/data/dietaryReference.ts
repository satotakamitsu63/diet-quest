import type { Nutrients } from './nutrients';

export type Sex = 'male' | 'female';

/** 身体活動レベル I（低い）/ II（ふつう）/ III（高い） */
export type ActivityLevel = 1 | 2 | 3;

/**
 * 日本人の食事摂取基準（2020年版）より、年齢区分ごとの参照値。
 * エネルギーは推定エネルギー必要量、たんぱく質・カルシウム・鉄・ビタミンA/B1/B2/C は推奨量、
 * ビタミンD は目安量、食物繊維と食塩相当量は目標量。
 * 値を差し替えるときはこのファイルだけを直せばアプリ全体に反映される。
 */
type ReferenceRow = [
  minAge: number,
  maxAge: number,
  energyLow: number,
  energyMid: number,
  energyHigh: number,
  protein: number,
  calcium: number,
  iron: number,
  /** 月経ありの女性の推奨量。該当しない区分は 0 */
  ironWhenMenstruating: number,
  vitaminA: number,
  vitaminB1: number,
  vitaminB2: number,
  vitaminC: number,
  vitaminD: number,
  /** 食物繊維の目標量（以上）。設定のない区分は 0 */
  fiberMin: number,
  /** 食塩相当量の目標量（未満） */
  saltMax: number,
];

const MALE_ROWS: ReferenceRow[] = [
  [1, 2, 950, 950, 950, 20, 450, 4.5, 0, 400, 0.5, 0.6, 40, 3.0, 0, 3.0],
  [3, 5, 1300, 1300, 1300, 25, 600, 5.5, 0, 450, 0.7, 0.8, 50, 3.5, 8, 3.5],
  [6, 7, 1350, 1550, 1750, 30, 600, 5.5, 0, 400, 0.8, 0.9, 60, 4.5, 10, 4.5],
  [8, 9, 1600, 1850, 2100, 40, 650, 7.0, 0, 500, 1.0, 1.1, 70, 5.0, 11, 5.0],
  [10, 11, 1950, 2250, 2500, 45, 700, 8.5, 0, 600, 1.2, 1.4, 85, 6.5, 13, 6.0],
  [12, 14, 2300, 2600, 2900, 60, 1000, 10.0, 0, 800, 1.4, 1.6, 100, 8.0, 17, 7.0],
  [15, 17, 2500, 2800, 3150, 65, 800, 10.0, 0, 900, 1.5, 1.7, 100, 9.0, 19, 7.5],
  [18, 29, 2300, 2650, 3050, 65, 800, 7.5, 0, 850, 1.4, 1.6, 100, 8.5, 21, 7.5],
  [30, 49, 2300, 2700, 3050, 65, 750, 7.5, 0, 900, 1.4, 1.6, 100, 8.5, 21, 7.5],
  [50, 64, 2200, 2600, 2950, 65, 750, 7.5, 0, 900, 1.3, 1.5, 100, 8.5, 21, 7.5],
  [65, 74, 2050, 2400, 2750, 60, 750, 7.5, 0, 850, 1.3, 1.5, 100, 8.5, 20, 7.5],
  [75, 120, 1800, 2100, 2100, 60, 700, 7.0, 0, 800, 1.2, 1.3, 100, 8.5, 20, 7.5],
];

const FEMALE_ROWS: ReferenceRow[] = [
  [1, 2, 900, 900, 900, 20, 400, 4.5, 0, 350, 0.5, 0.5, 40, 3.5, 0, 3.0],
  [3, 5, 1250, 1250, 1250, 25, 550, 5.5, 0, 500, 0.7, 0.8, 50, 4.0, 8, 3.5],
  [6, 7, 1250, 1450, 1650, 30, 550, 5.5, 0, 400, 0.8, 0.9, 60, 5.0, 10, 4.5],
  [8, 9, 1500, 1700, 1900, 40, 750, 7.5, 0, 500, 0.9, 1.0, 70, 6.0, 11, 5.0],
  [10, 11, 1850, 2100, 2350, 50, 750, 8.5, 12.0, 600, 1.1, 1.3, 85, 8.0, 13, 6.0],
  [12, 14, 2150, 2400, 2700, 55, 800, 8.5, 12.0, 700, 1.3, 1.4, 100, 9.5, 17, 6.5],
  [15, 17, 2050, 2300, 2550, 55, 650, 7.0, 10.5, 650, 1.2, 1.4, 100, 8.5, 18, 6.5],
  [18, 29, 1700, 2000, 2300, 50, 650, 6.5, 10.5, 650, 1.1, 1.2, 100, 8.5, 18, 6.5],
  [30, 49, 1750, 2050, 2350, 50, 650, 6.5, 10.5, 700, 1.1, 1.2, 100, 8.5, 18, 6.5],
  [50, 64, 1650, 1950, 2250, 50, 650, 6.5, 11.0, 700, 1.1, 1.2, 100, 8.5, 18, 6.5],
  [65, 74, 1550, 1850, 2100, 50, 650, 6.0, 0, 700, 1.1, 1.2, 100, 8.5, 17, 6.5],
  [75, 120, 1400, 1650, 1650, 50, 600, 6.0, 0, 650, 0.9, 1.0, 100, 8.5, 17, 6.5],
];

const REFERENCE_ROWS: Record<Sex, ReferenceRow[]> = {
  male: MALE_ROWS,
  female: FEMALE_ROWS,
};

function findRow(age: number, sex: Sex): ReferenceRow {
  const rows = REFERENCE_ROWS[sex];
  const matched = rows.find((row) => age >= row[0] && age <= row[1]);
  return matched ?? rows[rows.length - 1];
}

export type NutrientTargets = {
  /** 1日に満たしたい量。energy は目標体重に応じて別途補正される */
  recommended: Nutrients;
  /** 上限として扱う栄養素（超えるとスコアが下がる） */
  limited: Array<keyof Nutrients>;
  /** 不足だけを見る栄養素 */
  boosted: Array<keyof Nutrients>;
};

export type ReferenceInput = {
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  /** 女性で月経がある場合に true。鉄の推奨量が上がる */
  isMenstruating: boolean;
};

/** 年齢・性別・活動量から1日の栄養素目標を組み立てる。 */
export function buildNutrientTargets(input: ReferenceInput): NutrientTargets {
  const row = findRow(input.age, input.sex);
  const energyByActivity = [row[2], row[3], row[4]];
  const energy = energyByActivity[input.activityLevel - 1];
  const ironWhenMenstruating = row[8];
  const iron =
    input.sex === 'female' && input.isMenstruating && ironWhenMenstruating > 0
      ? ironWhenMenstruating
      : row[7];

  // 脂質は総エネルギーの25%、炭水化物は57.5%（目標量の範囲の中央値）を目安にする
  const fat = Math.round(((energy * 0.25) / 9) * 10) / 10;
  const carbohydrate = Math.round(((energy * 0.575) / 4) * 10) / 10;

  return {
    recommended: {
      energy,
      protein: row[5],
      fat,
      carbohydrate,
      fiber: row[14],
      calcium: row[6],
      iron,
      vitaminA: row[9],
      vitaminB1: row[10],
      vitaminB2: row[11],
      vitaminC: row[12],
      vitaminD: row[13],
      salt: row[15],
    },
    limited: ['salt', 'fat'],
    boosted: [
      'protein',
      'fiber',
      'calcium',
      'iron',
      'vitaminA',
      'vitaminB1',
      'vitaminB2',
      'vitaminC',
      'vitaminD',
    ],
  };
}

export const DIETARY_REFERENCE_SOURCE =
  '厚生労働省「日本人の食事摂取基準（2020年版）」';
