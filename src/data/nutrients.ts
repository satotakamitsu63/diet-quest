/** 本アプリで追跡する栄養素。単位はコメントのとおり。 */
export type Nutrients = {
  energy: number; // kcal
  protein: number; // g
  fat: number; // g
  carbohydrate: number; // g
  fiber: number; // g
  calcium: number; // mg
  iron: number; // mg
  vitaminA: number; // μgRAE
  vitaminB1: number; // mg
  vitaminB2: number; // mg
  vitaminC: number; // mg
  vitaminD: number; // μg
  salt: number; // g（食塩相当量）
};

export type NutrientKey = keyof Nutrients;

export const NUTRIENT_KEYS: NutrientKey[] = [
  'energy',
  'protein',
  'fat',
  'carbohydrate',
  'fiber',
  'calcium',
  'iron',
  'vitaminA',
  'vitaminB1',
  'vitaminB2',
  'vitaminC',
  'vitaminD',
  'salt',
];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  energy: 'エネルギー',
  protein: 'たんぱく質',
  fat: '脂質',
  carbohydrate: '炭水化物',
  fiber: '食物繊維',
  calcium: 'カルシウム',
  iron: '鉄',
  vitaminA: 'ビタミンA',
  vitaminB1: 'ビタミンB1',
  vitaminB2: 'ビタミンB2',
  vitaminC: 'ビタミンC',
  vitaminD: 'ビタミンD',
  salt: '食塩相当量',
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  energy: 'kcal',
  protein: 'g',
  fat: 'g',
  carbohydrate: 'g',
  fiber: 'g',
  calcium: 'mg',
  iron: 'mg',
  vitaminA: 'μgRAE',
  vitaminB1: 'mg',
  vitaminB2: 'mg',
  vitaminC: 'mg',
  vitaminD: 'μg',
  salt: 'g',
};

export function createEmptyNutrients(): Nutrients {
  return {
    energy: 0,
    protein: 0,
    fat: 0,
    carbohydrate: 0,
    fiber: 0,
    calcium: 0,
    iron: 0,
    vitaminA: 0,
    vitaminB1: 0,
    vitaminB2: 0,
    vitaminC: 0,
    vitaminD: 0,
    salt: 0,
  };
}

/** 複数の栄養素セットを合計する。 */
export function sumNutrients(entries: Nutrients[]): Nutrients {
  const total = createEmptyNutrients();
  for (const entry of entries) {
    for (const key of NUTRIENT_KEYS) {
      total[key] += entry[key];
    }
  }
  return total;
}

/** 100g あたりの値を指定グラム数ぶんに換算する。 */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const ratio = grams / 100;
  const scaled = createEmptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    scaled[key] = Math.round(per100g[key] * ratio * 1000) / 1000;
  }
  return scaled;
}
