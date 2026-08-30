import type { Sex } from '../data/dietaryReference';
import {
  NUTRIENT_KEYS,
  createEmptyNutrients,
  sumNutrients,
  type NutrientKey,
  type Nutrients,
} from '../data/nutrients';
import type { MealLog, Profile } from '../lib/types';
import type { BodyAssessment } from './bodyGoal';
import { isChild } from './bodyGoal';

/** エネルギーを減らす方向に調整するときでも、これ以下には下げない。 */
const ABSOLUTE_ENERGY_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
const ENERGY_DEFICIT_FOR_WEIGHT_LOSS = 400;
const ENERGY_SURPLUS_FOR_WEIGHT_GAIN = 300;

/**
 * 目標体型に合わせてエネルギー目標を補正する。
 * 小児と審美系競技モードでは減らす方向の補正をかけない。
 */
export function adjustEnergyTarget(
  baseEnergy: number,
  profile: Profile,
  age: number | null,
  assessment: BodyAssessment,
): number {
  if (isChild(age) || profile.aestheticSportMode) return baseEnergy;
  if (assessment.direction === 'reduce') {
    const floor = Math.max(ABSOLUTE_ENERGY_FLOOR[profile.sex], baseEnergy * 0.8);
    return Math.round(Math.max(floor, baseEnergy - ENERGY_DEFICIT_FOR_WEIGHT_LOSS));
  }
  if (assessment.direction === 'gain') {
    return baseEnergy + ENERGY_SURPLUS_FOR_WEIGHT_GAIN;
  }
  return baseEnergy;
}

/**
 * 成長期ブーストの倍率と上限。
 * 増やす目的は「背を伸ばす」ことではなく、伸びしろを取りこぼさないこと。
 * 推奨量を超えた分が遺伝的な到達身長を押し上げる根拠は無いため、上限を設けて青天井にしない。
 */
const GROWTH_BOOST = {
  protein: { multiplier: 1.2, perKilogramCap: 2.0 },
  calcium: { multiplier: 1.2, absoluteCap: 1000 },
  vitaminD: { multiplier: 1.25, absoluteCap: 15 },
} as const;

export type GrowthBoostInput = {
  targets: Nutrients;
  /** 体重(kg)。たんぱく質の上限に使う。不明なら null */
  weightKg: number | null;
};

/** 成長期ブーストを目標値に反映する。18歳未満にだけ適用する想定。 */
export function applyGrowthBoost(input: GrowthBoostInput): Nutrients {
  const { targets, weightKg } = input;

  const boostedProtein = targets.protein * GROWTH_BOOST.protein.multiplier;
  const proteinCap =
    weightKg !== null && weightKg > 0
      ? weightKg * GROWTH_BOOST.protein.perKilogramCap
      : Number.POSITIVE_INFINITY;

  return {
    ...targets,
    protein: Math.round(Math.min(boostedProtein, proteinCap) * 10) / 10,
    calcium: Math.round(
      Math.min(targets.calcium * GROWTH_BOOST.calcium.multiplier, GROWTH_BOOST.calcium.absoluteCap),
    ),
    vitaminD:
      Math.round(
        Math.min(
          targets.vitaminD * GROWTH_BOOST.vitaminD.multiplier,
          GROWTH_BOOST.vitaminD.absoluteCap,
        ) * 10,
      ) / 10,
  };
}

const BASE_WEIGHTS: Partial<Record<NutrientKey, number>> = {
  energy: 0.25,
  protein: 0.15,
  calcium: 0.1,
  iron: 0.1,
  fiber: 0.1,
  vitaminD: 0.06,
  vitaminC: 0.06,
  vitaminA: 0.05,
  vitaminB1: 0.04,
  vitaminB2: 0.04,
  salt: 0.05,
};

/** 成長期と審美系競技では、骨と血をつくる栄養素の重みを上げる。 */
const BONE_FOCUSED_WEIGHTS: Partial<Record<NutrientKey, number>> = {
  energy: 0.24,
  protein: 0.14,
  calcium: 0.15,
  iron: 0.15,
  fiber: 0.05,
  vitaminD: 0.12,
  vitaminC: 0.04,
  vitaminA: 0.04,
  vitaminB1: 0.03,
  vitaminB2: 0.03,
  salt: 0.01,
};

function resolveWeights(profile: Profile, age: number | null): Partial<Record<NutrientKey, number>> {
  return isChild(age) || profile.aestheticSportMode ? BONE_FOCUSED_WEIGHTS : BASE_WEIGHTS;
}

/** 不足だけを見る栄養素の得点。目標に届けば満点で、超えても加点しない。 */
function scoreShortfall(ratio: number): number {
  return Math.min(1, Math.max(0, ratio));
}

/** 上限として見る栄養素の得点。目標以内なら満点、超えるほど下がる。 */
function scoreExcess(ratio: number): number {
  if (ratio <= 1) return 1;
  return Math.max(0, 1 - (ratio - 1) / 0.6);
}

/** エネルギーの得点。多すぎても少なすぎても下がる山型。 */
function scoreEnergy(ratio: number): number {
  const deviation = Math.abs(ratio - 1);
  if (deviation <= 0.05) return 1;
  return Math.max(0, 1 - (deviation - 0.05) / 0.3);
}

export type DailySummary = {
  date: string;
  totals: Nutrients;
  targets: Nutrients;
  ratios: Record<NutrientKey, number>;
  /** 0〜100。記録がない日は null */
  score: number | null;
  energyRatio: number;
  shortfalls: NutrientKey[];
  excesses: NutrientKey[];
  hasRecord: boolean;
};

export type DailySummaryInput = {
  date: string;
  profile: Profile;
  age: number | null;
  logs: MealLog[];
  targets: Nutrients;
};

/** その日の食事記録を目標と突き合わせ、充足率と得点を出す。 */
export function summarizeDay(input: DailySummaryInput): DailySummary {
  const { date, profile, age, logs, targets } = input;
  const itemsOfDay = logs
    .filter((log) => log.date === date && log.profileId === profile.id)
    .flatMap((log) => log.items.map((item) => item.nutrients));
  const totals = itemsOfDay.length > 0 ? sumNutrients(itemsOfDay) : createEmptyNutrients();
  const hasRecord = itemsOfDay.length > 0;

  const ratios = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) {
    const target = targets[key];
    ratios[key] = target > 0 ? totals[key] / target : 1;
  }

  const weights = resolveWeights(profile, age);
  let weightedScore = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights) as Array<[NutrientKey, number]>) {
    if (targets[key] <= 0) continue;
    const ratio = ratios[key];
    const value =
      key === 'energy' ? scoreEnergy(ratio) : key === 'salt' ? scoreExcess(ratio) : scoreShortfall(ratio);
    weightedScore += value * weight;
    weightTotal += weight;
  }

  const shortfalls = NUTRIENT_KEYS.filter(
    (key) => key !== 'salt' && key !== 'fat' && targets[key] > 0 && ratios[key] < 0.7,
  );
  const excesses = NUTRIENT_KEYS.filter(
    (key) => (key === 'salt' || key === 'energy' || key === 'fat') && ratios[key] > 1.2,
  );

  return {
    date,
    totals,
    targets,
    ratios,
    score: hasRecord && weightTotal > 0 ? Math.round((weightedScore / weightTotal) * 100) : null,
    energyRatio: ratios.energy,
    shortfalls,
    excesses,
    hasRecord,
  };
}

export const MAX_GROWTH_STAGE = 9;

/** 各段階に上がるのに必要な累計経験値。1日満点でおよそ10。 */
const STAGE_THRESHOLDS = [0, 15, 40, 80, 140, 220, 320, 450, 620, 850];

export type CharacterCondition = 'exhausted' | 'tired' | 'steady' | 'glowing';

export const CONDITION_LABELS: Record<CharacterCondition, string> = {
  exhausted: 'やつれている',
  tired: 'すこし元気がない',
  steady: '元気',
  glowing: '輝いている',
};

export type CharacterState = {
  totalExperience: number;
  growthStage: number;
  /** 次の段階までの進み具合 0〜1 */
  progressToNextStage: number;
  condition: CharacterCondition;
  /** 記録が途切れずに続いている日数 */
  streakDays: number;
  recentAverageScore: number;
  shapeValue: number;
  /** 目標体型への近さ 0〜1。成長速度に効く */
  proximity: number;
};

/**
 * 1日ぶんの経験値。栄養の得点が主で、目標体型への近さが倍率として効く。
 * 痩せれば伸びるのではなく、必要量を満たしたうえで目標体型に近いほど伸びる。
 */
function experienceForDay(score: number, proximity: number): number {
  return (score / 100) * 10 * (0.4 + 0.6 * proximity);
}

function stageFromExperience(experience: number): { stage: number; progress: number } {
  let stage = 0;
  for (let index = 0; index < STAGE_THRESHOLDS.length; index += 1) {
    if (experience >= STAGE_THRESHOLDS[index]) stage = index;
  }
  if (stage >= MAX_GROWTH_STAGE) return { stage: MAX_GROWTH_STAGE, progress: 1 };
  const current = STAGE_THRESHOLDS[stage];
  const next = STAGE_THRESHOLDS[stage + 1];
  return { stage, progress: (experience - current) / (next - current) };
}

function resolveCondition(summaries: DailySummary[], recentAverage: number): CharacterCondition {
  const recorded = summaries.filter((summary) => summary.hasRecord);
  const lastThree = recorded.slice(-3);
  const starving =
    lastThree.length === 3 && lastThree.every((summary) => summary.energyRatio < 0.7);
  if (starving) return 'exhausted';
  if (recentAverage >= 85) return 'glowing';
  if (recentAverage >= 60) return 'steady';
  if (recorded.length === 0) return 'tired';
  return 'tired';
}

function countStreak(summaries: DailySummary[]): number {
  let streak = 0;
  for (let index = summaries.length - 1; index >= 0; index -= 1) {
    const summary = summaries[index];
    if (summary.hasRecord && (summary.score ?? 0) >= 50) streak += 1;
    else break;
  }
  return streak;
}

export type CharacterStateInput = {
  /** 日付の古い順に並んだ日次サマリー */
  summaries: DailySummary[];
  assessment: BodyAssessment;
};

/** 日次サマリーの積み上げからキャラクターの状態を決める。 */
export function buildCharacterState(input: CharacterStateInput): CharacterState {
  const { summaries, assessment } = input;
  const proximity = assessment.proximity;

  let totalExperience = 0;
  let starvingRun = 0;
  for (const summary of summaries) {
    if (!summary.hasRecord) continue;
    if (summary.energyRatio < 0.7) {
      starvingRun += 1;
      // 極端な少食が続くと、キャラクターは伸びるどころかやつれていく
      if (starvingRun >= 3) totalExperience = Math.max(0, totalExperience - 4);
    } else {
      starvingRun = 0;
    }
    totalExperience += experienceForDay(summary.score ?? 0, proximity);
  }

  const recorded = summaries.filter((summary) => summary.hasRecord);
  const recentWindow = recorded.slice(-7);
  const recentAverageScore =
    recentWindow.length > 0
      ? Math.round(
          recentWindow.reduce((total, summary) => total + (summary.score ?? 0), 0) /
            recentWindow.length,
        )
      : 0;

  const { stage, progress } = stageFromExperience(totalExperience);
  const condition = resolveCondition(summaries, recentAverageScore);

  return {
    totalExperience: Math.round(totalExperience * 10) / 10,
    // やつれているときは見た目の段階を1つ落とす
    growthStage: condition === 'exhausted' ? Math.max(0, stage - 1) : stage,
    progressToNextStage: Math.min(1, Math.max(0, progress)),
    condition,
    streakDays: countStreak(summaries),
    recentAverageScore,
    shapeValue: assessment.shapeValue,
    proximity,
  };
}
