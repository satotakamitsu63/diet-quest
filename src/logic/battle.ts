import { AWARD_SCALE_POINTS, CLUBS, type AwardCategory, type ClubKey, type StatKey } from '../data/clubs';
import { NUTRIENT_LABELS, type NutrientKey } from '../data/nutrients';
import type { Award, CharacterSpecies } from '../lib/types';
import type { DailySummary } from './score';
import type { CharacterState } from './score';

/**
 * 対戦の強さは「栄養素の充足率」と「記録の継続」だけから決める。
 * 体重・体脂肪率・痩せ具合は一切使わない。
 * 細いほど強いキャラになると、成長期の子に食事制限の動機を与えてしまうため。
 * さらに、エネルギー不足が続いて「やつれ」状態になると全ステータスが下がる。
 */

export type BattleStats = Record<StatKey, number> & { level: number };

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'たいりょく',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  speed: 'すばやさ',
  spirit: 'こんじょう',
};

/** どの栄養素がどのステータスになるかの対応。画面で理由を見せるために使う。 */
export const STAT_SOURCES: Record<StatKey, NutrientKey[]> = {
  hp: ['energy'],
  attack: ['protein'],
  defense: ['calcium', 'vitaminD'],
  speed: ['iron', 'vitaminB1', 'vitaminB2'],
  spirit: ['fiber', 'vitaminC', 'vitaminA'],
};

export const STAT_KEYS: StatKey[] = ['hp', 'attack', 'defense', 'speed', 'spirit'];

export function describeStatSource(stat: StatKey): string {
  return STAT_SOURCES[stat].map((key) => NUTRIENT_LABELS[key]).join('・');
}

const BATTLE_WINDOW_DAYS = 14;

/** 充足率の平均。1.0 を超えた分は数えないので、食べ過ぎても強くならない。 */
function averageSufficiency(summaries: DailySummary[], keys: NutrientKey[]): number {
  const recorded = summaries.filter((summary) => summary.hasRecord);
  if (recorded.length === 0) return 0;
  let total = 0;
  for (const summary of recorded) {
    const perDay =
      keys.reduce((sum, key) => sum + Math.min(1, Math.max(0, summary.ratios[key])), 0) / keys.length;
    total += perDay;
  }
  return total / recorded.length;
}

/** エネルギーは多すぎても少なすぎても下がる山型で評価する。 */
function averageEnergyBalance(summaries: DailySummary[]): number {
  const recorded = summaries.filter((summary) => summary.hasRecord);
  if (recorded.length === 0) return 0;
  const total = recorded.reduce((sum, summary) => {
    const deviation = Math.abs(summary.energyRatio - 1);
    return sum + Math.max(0, 1 - deviation / 0.35);
  }, 0);
  return total / recorded.length;
}

/**
 * 年齢による補正。子どものほうが強くなるようにして、大人と対戦が成立するようにする。
 * 体格差をそのまま持ち込むと子どもが勝てず、続かないため。
 */
export function ageMultiplier(age: number | null): number {
  if (age === null) return 1;
  if (age <= 9) return 1.55;
  if (age <= 12) return 1.45;
  if (age <= 15) return 1.3;
  if (age <= 17) return 1.15;
  return 1;
}

/**
 * その年齢での目標体型にどれだけ近いかによる補正（肉体美）。
 * 細いほど強いのではなく、目標から離れるほど弱くなる左右対称の評価。
 * 太りすぎでも痩せすぎでも下がる。子どもの目標は身長別標準体重なので、
 * 食事を抜いて痩せると対戦でも弱くなる。
 */
export function physiqueMultiplier(proximity: number): number {
  return 0.75 + 0.35 * Math.min(1, Math.max(0, proximity));
}

export type AwardScore = { sports: number; study: number; art: number; total: number };

/** 評価点の上限。栄養より受賞歴が支配的にならないようにする。 */
export const AWARD_POINT_CAP = 20;

/** 受賞歴を分野ごとの評価点にする。 */
export function calculateAwardScore(awards: Award[]): AwardScore {
  const byCategory: Record<AwardCategory, number> = { sports: 0, study: 0, art: 0 };
  for (const award of awards) {
    byCategory[award.category] += AWARD_SCALE_POINTS[award.scale];
  }
  const total = Math.min(AWARD_POINT_CAP, byCategory.sports + byCategory.study + byCategory.art);
  return { ...byCategory, total };
}

/** 評価点による補正。最大でも +25% に留める。 */
export function awardMultiplier(score: AwardScore): number {
  return 1 + Math.min(0.25, score.total / (AWARD_POINT_CAP * 4));
}

/** 部活の必殺技名。自分で決めた名前があればそちらを使う。 */
export function resolveSpecialMoveName(club: ClubKey, customName: string | null): string {
  const trimmed = customName?.trim();
  return trimmed ? trimmed : CLUBS[club].specialMoveName;
}

/** 部活の得意ステータスに乗る倍率。 */
const AFFINITY_BONUS = 1.12;

const CONDITION_MULTIPLIER = {
  exhausted: 0.6,
  tired: 0.85,
  steady: 1,
  glowing: 1.05,
} as const;

export type BattleStatsInput = {
  summaries: DailySummary[];
  character: CharacterState;
  age: number | null;
  /** その年齢での目標体型への近さ 0〜1 */
  proximity: number;
  club: ClubKey;
  awards: Award[];
};

/** 各補正が何倍かかっているか。画面で内訳を見せるために返す。 */
export type BattleModifiers = {
  level: number;
  streak: number;
  condition: number;
  age: number;
  physique: number;
  award: number;
  awardScore: AwardScore;
  affinity: StatKey | null;
};

export type BattleBuild = { stats: BattleStats; modifiers: BattleModifiers };

/** 直近2週間の食事と、年齢・体型・部活・受賞歴から対戦用のステータスを組み立てる。 */
export function buildBattleBuild(input: BattleStatsInput): BattleBuild {
  const window = input.summaries.slice(-BATTLE_WINDOW_DAYS);
  const recordedDays = window.filter((summary) => summary.hasRecord).length;
  const consistency = Math.min(1, recordedDays / BATTLE_WINDOW_DAYS);

  const awardScore = calculateAwardScore(input.awards);
  const modifiers: BattleModifiers = {
    level: 1 + input.character.growthStage * 0.1,
    streak: 1 + Math.min(0.2, input.character.streakDays * 0.02),
    condition: CONDITION_MULTIPLIER[input.character.condition],
    age: ageMultiplier(input.age),
    physique: physiqueMultiplier(input.proximity),
    award: awardMultiplier(awardScore),
    awardScore,
    affinity: CLUBS[input.club].affinity,
  };

  const scale =
    modifiers.level *
    modifiers.streak *
    modifiers.condition *
    modifiers.age *
    modifiers.physique *
    modifiers.award;

  const shape = (value: number, key: StatKey) =>
    Math.max(1, Math.round(value * scale * (modifiers.affinity === key ? AFFINITY_BONUS : 1)));

  return {
    stats: {
      hp: shape(50 + 70 * averageEnergyBalance(window) + 30 * consistency, 'hp'),
      attack: shape(15 + 45 * averageSufficiency(window, STAT_SOURCES.attack), 'attack'),
      defense: shape(15 + 45 * averageSufficiency(window, STAT_SOURCES.defense), 'defense'),
      speed: shape(15 + 45 * averageSufficiency(window, STAT_SOURCES.speed), 'speed'),
      spirit: shape(10 + 40 * averageSufficiency(window, STAT_SOURCES.spirit), 'spirit'),
      level: input.character.growthStage + 1,
    },
    modifiers,
  };
}

export function buildBattleStats(input: BattleStatsInput): BattleStats {
  return buildBattleBuild(input).stats;
}

/** 同じ組み合わせなら同じ結果になるよう、日付と名前から乱数の種を作る。 */
function createSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export type Combatant = {
  profileId: string;
  displayName: string;
  characterName: string;
  species: CharacterSpecies;
  stats: BattleStats;
  shapeValue: number;
  growthStage: number;
  condition: CharacterState['condition'];
  /** 部活や自分で決めた必殺技の名前 */
  specialMoveName: string;
  modifiers: BattleModifiers;
};

export type BattleTurn = {
  attackerName: string;
  defenderName: string;
  damage: number;
  isCritical: boolean;
  isSpecial: boolean;
  remainingHp: number;
  message: string;
};

export type BattleResult = {
  turns: BattleTurn[];
  winnerProfileId: string | null;
  /** 決着がつかず残り体力で判定した場合 true */
  decidedByRemainingHp: boolean;
  summary: string;
};

const MAXIMUM_TURNS = 40;
const SPECIAL_MOVE_STAGE = 5;

/**
 * 実力が近い相手どうしで10ターン前後の攻防になるよう抑えた係数。
 * 大きすぎると一撃で終わり、小さすぎると決着がつかない。
 */
const DAMAGE_SCALE = 0.6;

function calculateDamage(
  attacker: BattleStats,
  defender: BattleStats,
  multiplier: number,
  random: () => number,
): number {
  const base = (attacker.attack * attacker.attack) / (attacker.attack + defender.defense);
  const variance = 0.85 + random() * 0.3;
  return Math.max(1, Math.round(base * DAMAGE_SCALE * multiplier * variance));
}

/** 2体の対戦を最後まで再生する。同じ相手・同じ日なら結果は変わらない。 */
export function simulateBattle(left: Combatant, right: Combatant, seedText: string): BattleResult {
  const random = createRandom(createSeed(seedText));
  const health: Record<string, number> = {
    [left.profileId]: left.stats.hp,
    [right.profileId]: right.stats.hp,
  };
  const specialUsed: Record<string, boolean> = {
    [left.profileId]: false,
    [right.profileId]: false,
  };

  // すばやさが高いほうが先攻。同値ならレベルの高いほう
  const leftGoesFirst =
    left.stats.speed !== right.stats.speed
      ? left.stats.speed > right.stats.speed
      : left.stats.level >= right.stats.level;
  const order: Combatant[] = leftGoesFirst ? [left, right] : [right, left];

  const turns: BattleTurn[] = [];
  let winnerProfileId: string | null = null;

  for (let turnIndex = 0; turnIndex < MAXIMUM_TURNS && winnerProfileId === null; turnIndex += 1) {
    const attacker = order[turnIndex % 2];
    const defender = order[(turnIndex + 1) % 2];

    const isCritical = random() < Math.min(0.3, attacker.stats.spirit / 200);
    const healthRatio = health[attacker.profileId] / attacker.stats.hp;
    const canUseSpecial =
      attacker.growthStage >= SPECIAL_MOVE_STAGE &&
      !specialUsed[attacker.profileId] &&
      healthRatio < 0.4;
    if (canUseSpecial) specialUsed[attacker.profileId] = true;

    const multiplier = (isCritical ? 1.5 : 1) * (canUseSpecial ? 1.8 : 1);
    const damage = calculateDamage(attacker.stats, defender.stats, multiplier, random);
    health[defender.profileId] = Math.max(0, health[defender.profileId] - damage);

    const parts = [`${attacker.characterName}の こうげき！`];
    if (canUseSpecial) parts[0] = `${attacker.characterName}の ${attacker.specialMoveName}！`;
    if (isCritical) parts.push('きゅうしょに あたった！');
    parts.push(`${defender.characterName}に ${damage}のダメージ`);

    turns.push({
      attackerName: attacker.characterName,
      defenderName: defender.characterName,
      damage,
      isCritical,
      isSpecial: canUseSpecial,
      remainingHp: health[defender.profileId],
      message: parts.join(' '),
    });

    if (health[defender.profileId] <= 0) winnerProfileId = attacker.profileId;
  }

  let decidedByRemainingHp = false;
  if (winnerProfileId === null) {
    decidedByRemainingHp = true;
    const leftRatio = health[left.profileId] / left.stats.hp;
    const rightRatio = health[right.profileId] / right.stats.hp;
    winnerProfileId =
      leftRatio === rightRatio ? null : leftRatio > rightRatio ? left.profileId : right.profileId;
  }

  const winner = [left, right].find((combatant) => combatant.profileId === winnerProfileId);
  const summary = winner
    ? `${winner.characterName}の 勝ち！`
    : 'ひきわけ！';

  return { turns, winnerProfileId, decidedByRemainingHp, summary };
}
