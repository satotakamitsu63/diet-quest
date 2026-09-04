import type { CharacterSpecies } from './types';

export type BodyCondition = 'thin' | 'normal' | 'fat';

/** 0（痩せ）〜1（太い）の体型値を、イラストの3段階（痩せ・標準・デブ）に振り分ける */
export function bodyConditionFromShape(shapeValue: number): BodyCondition {
  if (shapeValue < 0.35) return 'thin';
  if (shapeValue > 0.65) return 'fat';
  return 'normal';
}

/** 成長段階(0〜9)を、イラストのレベル(1〜9)に対応させる。最終段階(9)はレベル9を使い回す */
export function levelFromGrowthStage(growthStage: number): number {
  const stage = Math.min(9, Math.max(0, Math.round(growthStage)));
  return Math.min(9, stage + 1);
}

/** public/characters 以下の、そのキャラクターが表示すべき画像パス（BASE_URL からの相対） */
export function characterImagePath(species: CharacterSpecies, shapeValue: number, growthStage: number): string {
  const bodyCondition = bodyConditionFromShape(shapeValue);
  const level = levelFromGrowthStage(growthStage);
  return `characters/${species}/${bodyCondition}/${level}.png`;
}
