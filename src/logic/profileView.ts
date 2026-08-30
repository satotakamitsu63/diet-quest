import { buildNutrientTargets } from '../data/dietaryReference';
import type { Nutrients } from '../data/nutrients';
import { recentDateKeys } from '../lib/dates';
import type { AppData, Profile } from '../lib/types';
import { assessBody, findLatestBodyLog, isChild, resolveAge, type BodyAssessment } from './bodyGoal';
import { buildHeightGoal, calculateHeightVelocity, type HeightGoal, type HeightVelocity } from './heightGoal';
import { buildWeeklyReview, calculateDailyPenalty, type WeeklyReview } from './weeklyReview';
import {
  adjustEnergyTarget,
  applyGrowthBoost,
  buildCharacterState,
  summarizeDay,
  type CharacterState,
  type DailySummary,
} from './score';

export const HISTORY_DAYS = 30;

export type ProfileView = {
  profile: Profile;
  age: number | null;
  assessment: BodyAssessment;
  targets: Nutrients;
  today: DailySummary;
  history: DailySummary[];
  character: CharacterState;
  /** 18歳未満のときだけ意味を持つ身長の目標 */
  heightGoal: HeightGoal | null;
  heightVelocity: HeightVelocity | null;
  /** 成長期ブーストが効いているか */
  isGrowthBoosted: boolean;
  /** 直近7日の振り返りと、食べ方の直し方 */
  weeklyReview: WeeklyReview;
  /** 今日ぶんのマイナス点（0以下） */
  todayPenalty: number;
};

/** 1人ぶんの表示に必要な計算をまとめて行う。 */
export function buildProfileView(profile: Profile, data: AppData): ProfileView {
  const age = resolveAge(profile);
  const latestBodyLog = findLatestBodyLog(data.bodyLogs, profile.id);
  const assessment = assessBody({ profile, age, latestBodyLog });

  // 審美系競技モードでは活動量を高い側に寄せて、必要エネルギーを低く見積もらない
  const activityLevel = profile.aestheticSportMode ? 3 : profile.activityLevel;
  const base = buildNutrientTargets({
    age: age ?? 40,
    sex: profile.sex,
    activityLevel,
    isMenstruating: profile.isMenstruating,
  });

  const withEnergy: Nutrients = {
    ...base.recommended,
    energy: adjustEnergyTarget(base.recommended.energy, profile, age, assessment),
  };

  // 成長期ブーストは18歳未満にだけかける
  const isGrowthBoosted = profile.growthBoost && isChild(age);
  const targets: Nutrients = isGrowthBoosted
    ? applyGrowthBoost({ targets: withEnergy, weightKg: assessment.weightKg })
    : withEnergy;

  const dateKeys = recentDateKeys(HISTORY_DAYS);
  const history = dateKeys.map((date) =>
    summarizeDay({ date, profile, age, logs: data.mealLogs, targets }),
  );
  const today = history[history.length - 1];
  const character = buildCharacterState({ summaries: history, assessment });

  const currentHeightCm = latestBodyLog?.heightCm ?? profile.heightCm;

  return {
    profile,
    age,
    assessment,
    targets,
    today,
    history,
    character,
    heightGoal: isChild(age) ? buildHeightGoal(profile, currentHeightCm) : null,
    heightVelocity: isChild(age) ? calculateHeightVelocity(data.bodyLogs, profile.id) : null,
    isGrowthBoosted,
    weeklyReview: buildWeeklyReview({
      summaries: history.slice(-7),
      logs: data.mealLogs,
      profileId: profile.id,
      emphasizeBone: isChild(age) || profile.aestheticSportMode,
    }),
    todayPenalty: calculateDailyPenalty(today),
  };
}
