import { FOODS_BY_ID } from '../data/foods';
import {
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
  scaleNutrients,
  type NutrientKey,
} from '../data/nutrients';
import { formatShortDate } from '../lib/dates';
import type { MealLog } from '../lib/types';
import type { DailySummary } from './score';

/** 不足を見る栄養素。食塩とエネルギーは別枠で扱う。 */
const WATCHED_NUTRIENTS: NutrientKey[] = [
  'protein',
  'calcium',
  'iron',
  'vitaminD',
  'fiber',
  'vitaminA',
  'vitaminB1',
  'vitaminB2',
  'vitaminC',
];

/**
 * マイナス点の付け方。数えられる形にして、なぜその点数かを説明できるようにする。
 * 1日ごとに、目標の50%未満なら-10点、70%未満なら-5点。
 * まったく食べていない日でおよそ-100点になり、0〜100点のスコアと同じ桁で読める。
 */
export const PENALTY = {
  severeShortfall: -10,
  mildShortfall: -5,
  energyShortfall: -10,
  saltExcess: -5,
  missingRecord: -5,
} as const;

const SEVERE_RATIO = 0.5;
const MILD_RATIO = 0.7;
const SALT_LIMIT_RATIO = 1.3;

/** 単体で食べるものではないので、不足を埋める提案には出さない。 */
const SEASONING_IDS = new Set(['oil', 'butter', 'mayonnaise', 'dressing']);

/** その日1日ぶんのマイナス点。ホーム画面でその日のうちに気づけるようにする。 */
export function calculateDailyPenalty(summary: DailySummary): number {
  if (!summary.hasRecord) return PENALTY.missingRecord;
  let penalty = 0;
  for (const key of WATCHED_NUTRIENTS) {
    if (summary.targets[key] <= 0) continue;
    penalty += penaltyForRatio(summary.ratios[key]);
  }
  if (summary.energyRatio < MILD_RATIO) penalty += PENALTY.energyShortfall;
  if (summary.ratios.salt > SALT_LIMIT_RATIO) penalty += PENALTY.saltExcess;
  return penalty;
}

export type NutrientReview = {
  key: NutrientKey;
  label: string;
  unit: string;
  averageRatio: number;
  /** 目標の70%未満だった日数 */
  shortDays: number;
  /** 1日あたり平均でどれだけ足りないか */
  averageShortfall: number;
  penalty: number;
};

export type FoodContribution = {
  name: string;
  /** その栄養素をこの1週間で何単位ぶん持ち込んだか */
  amount: number;
  /** 食べた回数 */
  times: number;
};

export type WeeklyAdvice = {
  kind: 'shortfall' | 'excess' | 'consistency' | 'praise';
  headline: string;
  detail: string;
  actions: string[];
};

export type WeeklyReview = {
  startDate: string;
  endDate: string;
  recordedDays: number;
  totalDays: number;
  averageScore: number;
  /** 合計のマイナス点（0以下） */
  penaltyPoints: number;
  missingRecordPenalty: number;
  nutrients: NutrientReview[];
  advice: WeeklyAdvice[];
};

function penaltyForRatio(ratio: number): number {
  if (ratio < SEVERE_RATIO) return PENALTY.severeShortfall;
  if (ratio < MILD_RATIO) return PENALTY.mildShortfall;
  return 0;
}

/** その週に実際に食べたもののうち、指定の栄養素を多く持ち込んだ食品を並べる。 */
export function aggregateContributions(
  logs: MealLog[],
  dateKeys: string[],
  profileId: string,
  nutrient: NutrientKey,
): FoodContribution[] {
  const totals = new Map<string, FoodContribution>();
  for (const log of logs) {
    if (log.profileId !== profileId || !dateKeys.includes(log.date)) continue;
    for (const item of log.items) {
      const amount = item.nutrients[nutrient];
      if (amount <= 0) continue;
      const existing = totals.get(item.name);
      if (existing) {
        existing.amount += amount;
        existing.times += 1;
      } else {
        totals.set(item.name, { name: item.name, amount, times: 1 });
      }
    }
  }
  return [...totals.values()]
    .map((entry) => ({ ...entry, amount: Math.round(entry.amount * 10) / 10 }))
    .sort((left, right) => right.amount - left.amount);
}

function formatAmount(value: number, unit: string): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

/**
 * 不足を埋める候補を選ぶ。
 * 1食分の量だけで並べると、量の多い丼や麺類が上位に来て「パスタを3皿」のような
 * 実行しにくい提案になる。1食分あたりの量を、盛りの大きさで割り引いて並べる。
 */
function rankByDensity(nutrient: NutrientKey) {
  return [...FOODS_BY_ID.values()]
    .filter((food) => food.category !== '菓子' && !SEASONING_IDS.has(food.id))
    .map((food) => {
      const perServing = scaleNutrients(food.per100g, food.servingGrams)[nutrient];
      return {
        food,
        perServing,
        rank: perServing / Math.sqrt(Math.max(100, food.servingGrams) / 100),
      };
    })
    .filter((entry) => entry.perServing > 0)
    .sort((left, right) => right.rank - left.rank);
}

/** 不足量を埋めるために足すものを、1食分ぶんずつ言葉にする。 */
function buildFillSuggestions(nutrient: NutrientKey, shortfall: number): string[] {
  const unit = NUTRIENT_UNITS[nutrient];
  const candidates = rankByDensity(nutrient).slice(0, 3);
  const lines = candidates.map(
    (entry) =>
      `${entry.food.name}（${entry.food.servingLabel}）を足すと ＋${formatAmount(entry.perServing, unit)}`,
  );
  const best = candidates[0]?.perServing ?? 0;
  if (best > 0 && best < shortfall) {
    lines.push('1品では埋まらないので、上のうち2〜3品を組み合わせてください');
  }
  return lines;
}

export type WeeklyReviewInput = {
  /** 古い順に並んだ、その週ぶんの日次サマリー */
  summaries: DailySummary[];
  logs: MealLog[];
  profileId: string;
  /** 成長期や審美系競技など、注意して見るべき事情がある場合 */
  emphasizeBone: boolean;
};

/** 1週間の食事を振り返り、マイナス点と具体的な直し方を出す。 */
export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const { summaries, logs, profileId, emphasizeBone } = input;
  const dateKeys = summaries.map((summary) => summary.date);
  const recorded = summaries.filter((summary) => summary.hasRecord);

  const missingRecordPenalty = (summaries.length - recorded.length) * PENALTY.missingRecord;

  const nutrients: NutrientReview[] = WATCHED_NUTRIENTS.map((key) => {
    const withTarget = recorded.filter((summary) => summary.targets[key] > 0);
    const averageRatio =
      withTarget.length === 0
        ? 0
        : withTarget.reduce((total, summary) => total + summary.ratios[key], 0) / withTarget.length;
    const shortDays = withTarget.filter((summary) => summary.ratios[key] < MILD_RATIO).length;
    const averageShortfall =
      withTarget.length === 0
        ? 0
        : withTarget.reduce(
            (total, summary) => total + Math.max(0, summary.targets[key] - summary.totals[key]),
            0,
          ) / withTarget.length;
    const penalty = withTarget.reduce(
      (total, summary) => total + penaltyForRatio(summary.ratios[key]),
      0,
    );
    return {
      key,
      label: NUTRIENT_LABELS[key],
      unit: NUTRIENT_UNITS[key],
      averageRatio,
      shortDays,
      averageShortfall: Math.round(averageShortfall * 10) / 10,
      penalty,
    };
  });

  const energyPenalty = recorded.reduce(
    (total, summary) => total + (summary.energyRatio < MILD_RATIO ? PENALTY.energyShortfall : 0),
    0,
  );
  const saltPenalty = recorded.reduce(
    (total, summary) => total + (summary.ratios.salt > SALT_LIMIT_RATIO ? PENALTY.saltExcess : 0),
    0,
  );

  const penaltyPoints =
    nutrients.reduce((total, entry) => total + entry.penalty, 0) +
    energyPenalty +
    saltPenalty +
    missingRecordPenalty;

  const averageScore =
    recorded.length === 0
      ? 0
      : Math.round(recorded.reduce((total, summary) => total + (summary.score ?? 0), 0) / recorded.length);

  const advice: WeeklyAdvice[] = [];

  // 記録の抜け
  if (summaries.length - recorded.length > 0) {
    advice.push({
      kind: 'consistency',
      headline: `記録がない日が ${summaries.length - recorded.length}日 ありました（${missingRecordPenalty}点）`,
      detail:
        '記録がない日は評価できないため、キャラクターも育ちません。全部を細かく書かなくても、主食・主菜・汁物だけでも入れておくと差が出ます。',
      actions: ['食べ終わったその場で話しかけて入力する', '思い出せない日は、だいたいの内容でよいので入れる'],
    });
  }

  // エネルギー不足
  if (energyPenalty < 0) {
    const days = energyPenalty / PENALTY.energyShortfall;
    advice.push({
      kind: 'shortfall',
      headline: `エネルギーが足りない日が ${days}日 ありました（${energyPenalty}点）`,
      detail: emphasizeBone
        ? '成長期にエネルギーが足りないと、たんぱく質を食べていても体をつくるほうに回らず、身長の伸びと骨の量に響きます。まず主食の量を戻してください。'
        : '摂取が少なすぎると筋量が落ち、代謝も下がります。減量中でも必要量の8割は下回らないようにしてください。',
      actions: ['ごはんを一膳ぶん足す（約230kcal）', '間食をおにぎりやヨーグルトなど食事寄りのものにする'],
    });
  }

  // 不足の大きい栄養素から3つ
  const worst = nutrients
    .filter((entry) => entry.shortDays > 0)
    .sort((left, right) => left.averageRatio - right.averageRatio)
    .slice(0, 3);

  for (const entry of worst) {
    const actions = buildFillSuggestions(entry.key, entry.averageShortfall);
    // いま摂れている量がごくわずかな食品を「これで摂れている」と書くと誤解を生むので、
    // 1週間ぶんの目標の2割以上を持ち込んでいるものだけを挙げる
    const weeklyTarget = (recorded[0]?.targets[entry.key] ?? 0) * recorded.length;
    const meaningful = aggregateContributions(logs, dateKeys, profileId, entry.key).filter(
      (food) => weeklyTarget > 0 && food.amount >= weeklyTarget * 0.2,
    );
    if (meaningful.length > 0) {
      actions.push(
        `いま ${entry.label} の主な供給源は ${meaningful
          .slice(0, 2)
          .map((food) => `${food.name}（週${food.times}回で${formatAmount(food.amount, entry.unit)}）`)
          .join('、')}。この回数を増やすのがいちばん早い`,
      );
    }
    advice.push({
      kind: 'shortfall',
      headline: `${entry.label}が ${entry.shortDays}日 足りませんでした（${entry.penalty}点）`,
      detail: `1日あたり平均で ${formatAmount(entry.averageShortfall, entry.unit)} 足りていません。充足率は平均 ${Math.round(
        entry.averageRatio * 100,
      )}% でした。`,
      actions,
    });
  }

  // 食塩の取りすぎ
  if (saltPenalty < 0) {
    const saltyFoods = aggregateContributions(logs, dateKeys, profileId, 'salt').slice(0, 3);
    advice.push({
      kind: 'excess',
      headline: `食塩が目標を大きく超えた日が ${saltPenalty / PENALTY.saltExcess}日 ありました（${saltPenalty}点）`,
      detail:
        saltyFoods.length > 0
          ? `この1週間で食塩がいちばん多かったのは ${saltyFoods
              .map((food) => `${food.name}（週${food.times}回で${formatAmount(food.amount, 'g')}）`)
              .join('、')} です。`
          : '汁物や麺類の汁を残すだけでも1食あたり1〜2g減ります。',
      actions: [
        '麺類の汁を残す（1杯で約2g減る）',
        '漬物・加工肉を毎日から隔日にする',
        '味噌汁を1日2杯から1杯にする（約1g減る）',
      ],
    });
  }

  if (advice.length === 0) {
    advice.push({
      kind: 'praise',
      headline: 'この1週間、大きな不足はありませんでした',
      detail: `平均スコアは ${averageScore}点、記録できた日は ${recorded.length}日です。`,
      actions: ['いまの食べ方を続ける'],
    });
  }

  return {
    startDate: dateKeys[0] ?? '',
    endDate: dateKeys[dateKeys.length - 1] ?? '',
    recordedDays: recorded.length,
    totalDays: summaries.length,
    averageScore,
    penaltyPoints,
    missingRecordPenalty,
    nutrients,
    advice,
  };
}

/** 「8/24(月)〜8/30(日)」のような期間の表示。 */
export function formatReviewRange(review: WeeklyReview): string {
  if (!review.startDate || !review.endDate) return '';
  return `${formatShortDate(review.startDate)}〜${formatShortDate(review.endDate)}`;
}
