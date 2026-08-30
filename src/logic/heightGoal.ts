import type { Sex } from '../data/dietaryReference';
import type { BodyLog, Profile } from '../lib/types';

/**
 * 両親の身長からの予測成人身長（target height / mid-parental height）。
 * 男子 =（父 + 母 + 13）/ 2、女子 =（父 + 母 − 13）/ 2。
 * 実際の到達身長はこの前後およそ ±9cm に広がるため、点ではなく幅で見る。
 */
export const PREDICTED_HEIGHT_RANGE_CM = 9;

export function predictAdultHeight(
  sex: Sex,
  fatherHeightCm: number | null,
  motherHeightCm: number | null,
): number | null {
  if (fatherHeightCm === null || motherHeightCm === null) return null;
  if (fatherHeightCm <= 0 || motherHeightCm <= 0) return null;
  const adjustment = sex === 'male' ? 13 : -13;
  return Math.round(((fatherHeightCm + motherHeightCm + adjustment) / 2) * 10) / 10;
}

export type HeightGoal = {
  /** 目標にしている大人になったときの身長 */
  targetAdultHeightCm: number | null;
  /** 両親の身長から計算した予測値。手入力の目標と区別して見せる */
  predictedFromParentsCm: number | null;
  /** 予測値のばらつきの幅 */
  predictedRangeCm: [number, number] | null;
  /** 目標まであと何cmか */
  remainingCm: number | null;
  /** 目標に対して何%まで来ているか 0〜1 */
  progress: number | null;
};

/** 手入力の目標身長があればそれを、無ければ両親の身長からの予測を使う。 */
export function buildHeightGoal(profile: Profile, currentHeightCm: number | null): HeightGoal {
  const predicted = predictAdultHeight(profile.sex, profile.fatherHeightCm, profile.motherHeightCm);
  const target = profile.targetAdultHeightCm ?? predicted;

  return {
    targetAdultHeightCm: target,
    predictedFromParentsCm: predicted,
    predictedRangeCm:
      predicted === null
        ? null
        : [
            Math.round((predicted - PREDICTED_HEIGHT_RANGE_CM) * 10) / 10,
            Math.round((predicted + PREDICTED_HEIGHT_RANGE_CM) * 10) / 10,
          ],
    remainingCm:
      target === null || currentHeightCm === null
        ? null
        : Math.round((target - currentHeightCm) * 10) / 10,
    progress:
      target === null || currentHeightCm === null || target <= 0
        ? null
        : Math.min(1, Math.max(0, currentHeightCm / target)),
  };
}

export type HeightVelocity = {
  /** 1年あたりの伸び(cm) */
  centimetersPerYear: number;
  /** 計算に使った期間(日) */
  spanDays: number;
  /** 期間内の実測の伸び(cm) */
  gainCm: number;
};

const MINIMUM_SPAN_DAYS = 60;

/**
 * 身長の記録から1年あたりの伸びを求める。
 * 測定誤差の影響が大きいので、2か月以上離れた記録が2つ以上ないと計算しない。
 */
export function calculateHeightVelocity(
  bodyLogs: BodyLog[],
  profileId: string,
): HeightVelocity | null {
  const withHeight = bodyLogs
    .filter((log) => log.profileId === profileId && log.heightCm !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (withHeight.length < 2) return null;

  const oldest = withHeight[0];
  const newest = withHeight[withHeight.length - 1];
  const spanDays =
    (new Date(`${newest.date}T00:00:00`).getTime() - new Date(`${oldest.date}T00:00:00`).getTime()) /
    (1000 * 60 * 60 * 24);
  if (spanDays < MINIMUM_SPAN_DAYS) return null;

  const gainCm = (newest.heightCm ?? 0) - (oldest.heightCm ?? 0);
  return {
    centimetersPerYear: Math.round((gainCm / spanDays) * 365 * 10) / 10,
    spanDays: Math.round(spanDays),
    gainCm: Math.round(gainCm * 10) / 10,
  };
}

/**
 * 年齢・性別ごとの、1年あたりの伸びのおおよその目安(cm)。
 * 個人差と思春期の時期のずれが大きいため、判定ではなく参考として見せる。
 */
export function referenceVelocityRange(age: number, sex: Sex): [number, number] | null {
  if (age < 4 || age > 17) return null;
  if (sex === 'female') {
    if (age <= 9) return [5, 7];
    if (age <= 13) return [6, 9];
    return [0, 4];
  }
  if (age <= 10) return [5, 7];
  if (age <= 15) return [6, 10];
  return [0, 4];
}
