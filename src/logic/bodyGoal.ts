import type { Sex } from '../data/dietaryReference';
import {
  CHILD_STANDARD_WEIGHT_MAX_AGE,
  calculateChildStandardWeight,
  classifyObesityRate,
} from '../data/childStandardWeight';
import type { BodyLog, GoalPreset, Profile } from '../lib/types';

/** 大人が目標として設定できる BMI の下限。これ未満は低体重域なので許可しない。 */
export const MINIMUM_TARGET_BMI = 18.5;
export const MAXIMUM_TARGET_BMI = 26.0;
export const ADULT_AGE_THRESHOLD = 18;

/**
 * 目標として設定できる体脂肪率の下限。必須脂肪を割り込むと
 * 男性はホルモン低下、女性は無月経と骨密度低下を招くため、これ以下は選べない。
 */
export const MINIMUM_TARGET_BODY_FAT: Record<Sex, number> = { male: 6, female: 14 };
export const MAXIMUM_TARGET_BODY_FAT: Record<Sex, number> = { male: 25, female: 32 };

type PresetDefinition = {
  label: string;
  description: string;
  targetBmi: Record<Sex, number>;
  targetBodyFatPercent: Record<Sex, number>;
  /** 体型判定で体脂肪率をどれだけ重く見るか（0〜1）。残りは BMI が受け持つ */
  bodyFatWeight: number;
};

export const GOAL_PRESETS: Record<Exclude<GoalPreset, 'custom'>, PresetDefinition> = {
  health: {
    label: '健康維持',
    description: '統計上いちばん病気になりにくい体重（BMI 22）。見た目より健康を優先する目標。',
    targetBmi: { male: 22.0, female: 22.0 },
    targetBodyFatPercent: { male: 18, female: 25 },
    bodyFatWeight: 0.3,
  },
  ideal: {
    label: '理想体型',
    description: '標準体重よりすこし絞った、見た目の理想とされる体型。既定の目標。',
    targetBmi: { male: 21.5, female: 20.0 },
    targetBodyFatPercent: { male: 14, female: 22 },
    bodyFatWeight: 0.5,
  },
  athletic: {
    label: 'アスリート体型',
    description: '筋量を保ったまま体脂肪を落とす体型。運動量が多い人向け。',
    targetBmi: { male: 22.5, female: 19.5 },
    targetBodyFatPercent: { male: 11, female: 19 },
    bodyFatWeight: 0.65,
  },
  physique: {
    label: 'フィジーク・審美系',
    description:
      '体重より体脂肪率で仕上がりを見る目標。BMI は筋量ぶん高めに出るので、判定は体脂肪率を主に見る。',
    targetBmi: { male: 21.0, female: 19.0 },
    targetBodyFatPercent: { male: 8, female: 16 },
    bodyFatWeight: 0.7,
  },
};

/** 生年月日または直接入力から年齢を求める。どちらも無ければ null。 */
export function resolveAge(profile: Profile, today: Date = new Date()): number | null {
  if (profile.birthDate) {
    const birth = new Date(profile.birthDate);
    if (!Number.isNaN(birth.getTime())) {
      let age = today.getFullYear() - birth.getFullYear();
      const hasHadBirthdayThisYear =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
      if (!hasHadBirthdayThisYear) age -= 1;
      return age;
    }
  }
  return profile.ageYears;
}

export function isChild(age: number | null): boolean {
  return age !== null && age < ADULT_AGE_THRESHOLD;
}

/** プロフィールから目標 BMI を決める。小児には目標体重を設定しないので null。 */
export function resolveTargetBmi(
  profile: Profile,
  age: number | null,
  heightCm: number | null = null,
): number | null {
  if (isChild(age)) return null;
  if (profile.goalPreset === 'custom') {
    const height = heightCm ?? profile.heightCm;
    if (profile.customTargetWeightKg !== null && height !== null && height > 0) {
      const meters = height / 100;
      return clamp(
        profile.customTargetWeightKg / (meters * meters),
        MINIMUM_TARGET_BMI,
        MAXIMUM_TARGET_BMI,
      );
    }
    if (profile.customTargetBmi !== null) {
      return clamp(profile.customTargetBmi, MINIMUM_TARGET_BMI, MAXIMUM_TARGET_BMI);
    }
    return GOAL_PRESETS.ideal.targetBmi[profile.sex];
  }
  return GOAL_PRESETS[profile.goalPreset].targetBmi[profile.sex];
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** その身長で設定できる目標体重の下限(kg)。BMI 18.5 に相当する。 */
export function minimumTargetWeightKg(heightCm: number): number {
  const meters = heightCm / 100;
  return roundToTenth(MINIMUM_TARGET_BMI * meters * meters);
}

/** その身長で設定できる目標体重の上限(kg)。 */
export function maximumTargetWeightKg(heightCm: number): number {
  const meters = heightCm / 100;
  return roundToTenth(MAXIMUM_TARGET_BMI * meters * meters);
}

/** 入力された目標体重が受け入れ範囲に収まるか調べる。UI で理由を出すために使う。 */
export function checkTargetWeight(
  targetWeightKg: number,
  heightCm: number,
): { accepted: number; reason: string | null } {
  const minimum = minimumTargetWeightKg(heightCm);
  const maximum = maximumTargetWeightKg(heightCm);
  if (targetWeightKg < minimum) {
    return {
      accepted: minimum,
      reason: `身長 ${heightCm}cm では ${minimum}kg（BMI ${MINIMUM_TARGET_BMI}）が下限です。これより軽い目標は低体重域に入るため ${minimum}kg として扱います。`,
    };
  }
  if (targetWeightKg > maximum) {
    return {
      accepted: maximum,
      reason: `身長 ${heightCm}cm では ${maximum}kg（BMI ${MAXIMUM_TARGET_BMI}）が上限です。${maximum}kg として扱います。`,
    };
  }
  return { accepted: roundToTenth(targetWeightKg), reason: null };
}

export function resolveTargetBodyFatPercent(profile: Profile, age: number | null): number | null {
  if (isChild(age)) return null;
  if (profile.goalPreset === 'custom' && profile.customTargetBodyFatPercent !== null) {
    return clamp(
      profile.customTargetBodyFatPercent,
      MINIMUM_TARGET_BODY_FAT[profile.sex],
      MAXIMUM_TARGET_BODY_FAT[profile.sex],
    );
  }
  const preset = profile.goalPreset === 'custom' ? 'ideal' : profile.goalPreset;
  return GOAL_PRESETS[preset].targetBodyFatPercent[profile.sex];
}

/** 体型判定で体脂肪率をどれだけ重く見るか。体脂肪率が未入力なら 0。 */
export function resolveBodyFatWeight(profile: Profile, hasBodyFat: boolean): number {
  if (!hasBodyFat) return 0;
  const preset = profile.goalPreset === 'custom' ? 'ideal' : profile.goalPreset;
  return GOAL_PRESETS[preset].bodyFatWeight;
}

type Breakpoint = [input: number, output: number];

/** 折れ線で入力値を 0〜1 に写像する。 */
function interpolate(breakpoints: Breakpoint[], value: number): number {
  const first = breakpoints[0];
  const last = breakpoints[breakpoints.length - 1];
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const [lowInput, lowOutput] = breakpoints[index];
    const [highInput, highOutput] = breakpoints[index + 1];
    if (value >= lowInput && value <= highInput) {
      const ratio = (value - lowInput) / (highInput - lowInput);
      return lowOutput + (highOutput - lowOutput) * ratio;
    }
  }
  return last[1];
}

const BMI_TO_SHAPE: Breakpoint[] = [
  [15, 0.0],
  [17, 0.15],
  [18.5, 0.28],
  [20, 0.42],
  [22, 0.58],
  [25, 0.74],
  [28, 0.87],
  [33, 1.0],
];

const OBESITY_RATE_TO_SHAPE: Breakpoint[] = [
  [-30, 0.0],
  [-20, 0.15],
  [-10, 0.32],
  [0, 0.5],
  [10, 0.62],
  [20, 0.74],
  [30, 0.85],
  [50, 1.0],
];

const BODY_FAT_TO_SHAPE: Record<Sex, Breakpoint[]> = {
  male: [
    [5, 0.0],
    [10, 0.2],
    [15, 0.4],
    [20, 0.58],
    [25, 0.75],
    [30, 0.88],
    [40, 1.0],
  ],
  female: [
    [12, 0.0],
    [18, 0.2],
    [22, 0.38],
    [27, 0.55],
    [32, 0.72],
    [38, 0.88],
    [45, 1.0],
  ],
};

export type ShapeLabel =
  | 'がりがり'
  | 'ほっそり'
  | 'すらり'
  | '引き締まり'
  | 'ふつう'
  | 'ぽっちゃり'
  | 'まるまる';

const SHAPE_LABEL_BANDS: Array<[max: number, label: ShapeLabel]> = [
  [0.13, 'がりがり'],
  [0.26, 'ほっそり'],
  [0.4, 'すらり'],
  [0.55, '引き締まり'],
  [0.7, 'ふつう'],
  [0.85, 'ぽっちゃり'],
  [1.01, 'まるまる'],
];

export function describeShape(shapeValue: number): ShapeLabel {
  const band = SHAPE_LABEL_BANDS.find(([max]) => shapeValue < max);
  return band ? band[1] : 'まるまる';
}

export type BodyAssessment = {
  mode: 'adult' | 'child' | 'unknown';
  bmi: number | null;
  obesityRate: number | null;
  standardWeightKg: number | null;
  targetWeightKg: number | null;
  targetWeightRangeKg: [number, number] | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  targetBodyFatPercent: number | null;
  /** キャラクターの体型に渡す 0（細い）〜1（太い）の連続値 */
  shapeValue: number;
  /** 目標体型に対応する shapeValue */
  targetShapeValue: number;
  /** 目標体型への近さ 0〜1 */
  proximity: number;
  /** 身長体重が分からないときは判定せず「未測定」を返す */
  shapeLabel: ShapeLabel | '未測定';
  /** 目標に近づくには増やすか減らすか。差が小さいときは 'keep' */
  direction: 'reduce' | 'keep' | 'gain';
  caution: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 直近の身体記録を返す。 */
export function findLatestBodyLog(bodyLogs: BodyLog[], profileId: string): BodyLog | null {
  const own = bodyLogs
    .filter((log) => log.profileId === profileId)
    .sort((left, right) => right.date.localeCompare(left.date));
  return own[0] ?? null;
}

function buildCaution(
  mode: BodyAssessment['mode'],
  sex: Sex,
  bmi: number | null,
  obesityRate: number | null,
  bodyFatPercent: number | null = null,
): string | null {
  if (mode === 'adult' && bodyFatPercent !== null) {
    if (bodyFatPercent < MINIMUM_TARGET_BODY_FAT[sex]) {
      return sex === 'female'
        ? '体脂肪率が必須脂肪を割り込んでいます。無月経・骨密度低下・疲労骨折の危険域なので、増量に切り替えてください。'
        : '体脂肪率が必須脂肪を割り込んでいます。長く続けるとテストステロン低下と骨密度低下を招くので、コンテスト前の短期に留めてください。';
    }
  }
  if (mode === 'adult' && bmi !== null) {
    if (bmi < 17) {
      return '低体重域です。これ以上体重を減らす目標にはしないでください。無月経・骨密度低下・鉄欠乏の原因になります。';
    }
    if (bmi < 18.5) {
      return sex === 'female'
        ? '低体重域に入っています。減量ではなく、たんぱく質・鉄・カルシウムを満たすことを目標にしてください。'
        : '低体重域に入っています。減量ではなく筋量を保つ食事を目標にしてください。';
    }
  }
  if (mode === 'child' && obesityRate !== null) {
    if (obesityRate < -20) {
      return 'やせぎみです。成長期なので体重を減らす目標は持たせず、エネルギーとたんぱく質を満たすことを優先してください。小児科の受診も検討してください。';
    }
    if (obesityRate >= 30) {
      return '中等度以上の肥満に相当します。自己流の減量ではなく、小児科での評価をおすすめします。';
    }
  }
  return null;
}

export type BodyAssessmentInput = {
  profile: Profile;
  age: number | null;
  latestBodyLog: BodyLog | null;
};

/** 身長体重と目標設定から、体型の判定とキャラクター描画用のパラメータを作る。 */
export function assessBody(input: BodyAssessmentInput): BodyAssessment {
  const { profile, age, latestBodyLog } = input;
  const heightCm = latestBodyLog?.heightCm ?? profile.heightCm;
  const weightKg = latestBodyLog?.weightKg ?? null;
  const bodyFatPercent = latestBodyLog?.bodyFatPercent ?? null;

  const childMode = isChild(age) && age !== null && age <= CHILD_STANDARD_WEIGHT_MAX_AGE;

  if (heightCm === null || weightKg === null || heightCm <= 0) {
    // 身長体重が分からなくても使えるように、体型は中立にして栄養だけで評価する
    return {
      mode: 'unknown',
      bmi: null,
      obesityRate: null,
      standardWeightKg: null,
      targetWeightKg: null,
      targetWeightRangeKg: null,
      weightKg,
      bodyFatPercent,
      targetBodyFatPercent: resolveTargetBodyFatPercent(profile, age),
      shapeValue: 0.5,
      targetShapeValue: 0.5,
      proximity: 1,
      shapeLabel: '未測定',
      direction: 'keep',
      caution: null,
    };
  }

  const heightMeters = heightCm / 100;
  const bmi = Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;

  if (childMode && age !== null) {
    const standardWeightKg = calculateChildStandardWeight(age, profile.sex, heightCm);
    const obesityRate =
      standardWeightKg && standardWeightKg > 0
        ? Math.round(((weightKg - standardWeightKg) / standardWeightKg) * 1000) / 10
        : null;
    const shapeValue =
      obesityRate === null ? 0.5 : interpolate(OBESITY_RATE_TO_SHAPE, obesityRate);
    const targetShapeValue = interpolate(OBESITY_RATE_TO_SHAPE, 0);
    const category = obesityRate === null ? 'normal' : classifyObesityRate(obesityRate);
    return {
      mode: 'child',
      bmi,
      obesityRate,
      standardWeightKg,
      targetWeightKg: null,
      targetWeightRangeKg: standardWeightKg
        ? [
            Math.round(standardWeightKg * 0.85 * 10) / 10,
            Math.round(standardWeightKg * 1.15 * 10) / 10,
          ]
        : null,
      weightKg,
      bodyFatPercent,
      targetBodyFatPercent: null,
      shapeValue,
      targetShapeValue,
      proximity: clamp(1 - Math.abs(shapeValue - targetShapeValue) / 0.35, 0, 1),
      shapeLabel: describeShape(shapeValue),
      // 成長期は「減らす」方向の指示を出さない
      direction: category === 'underweight' || category === 'severelyUnderweight' ? 'gain' : 'keep',
      caution:
        buildCaution('child', profile.sex, bmi, obesityRate) ??
        (profile.aestheticSportMode
          ? 'バレエなど審美系競技をしている成長期の体です。体重を減らす目標は設定していません。エネルギー・鉄・カルシウム・ビタミンDが不足すると初経の遅れと疲労骨折につながるため、この4つの充足を最優先に見てください。'
          : null),
    };
  }

  const targetBmi =
    resolveTargetBmi(profile, age, heightCm) ?? GOAL_PRESETS.ideal.targetBmi[profile.sex];
  const targetWeightKg = Math.round(targetBmi * heightMeters * heightMeters * 10) / 10;
  const targetBodyFatPercent = resolveTargetBodyFatPercent(profile, age);
  const bodyFatWeight = resolveBodyFatWeight(profile, bodyFatPercent !== null);
  const bmiShape = interpolate(BMI_TO_SHAPE, bmi);
  const bodyFatShape =
    bodyFatPercent === null ? bmiShape : interpolate(BODY_FAT_TO_SHAPE[profile.sex], bodyFatPercent);
  const shapeValue = bmiShape * (1 - bodyFatWeight) + bodyFatShape * bodyFatWeight;

  const targetBmiShape = interpolate(BMI_TO_SHAPE, targetBmi);
  const targetBodyFatShape =
    targetBodyFatPercent === null
      ? targetBmiShape
      : interpolate(BODY_FAT_TO_SHAPE[profile.sex], targetBodyFatPercent);
  const targetShapeValue = targetBmiShape * (1 - bodyFatWeight) + targetBodyFatShape * bodyFatWeight;
  const difference = weightKg - targetWeightKg;

  return {
    mode: 'adult',
    bmi,
    obesityRate: null,
    standardWeightKg: Math.round(22 * heightMeters * heightMeters * 10) / 10,
    targetWeightKg,
    targetWeightRangeKg: [
      Math.round(Math.max(MINIMUM_TARGET_BMI, targetBmi - 1) * heightMeters * heightMeters * 10) / 10,
      Math.round((targetBmi + 1) * heightMeters * heightMeters * 10) / 10,
    ],
    weightKg,
    bodyFatPercent,
    targetBodyFatPercent,
    shapeValue,
    targetShapeValue,
    proximity: clamp(1 - Math.abs(shapeValue - targetShapeValue) / 0.35, 0, 1),
    shapeLabel: describeShape(shapeValue),
    direction: difference > 1.5 ? 'reduce' : difference < -1.5 ? 'gain' : 'keep',
    caution: buildCaution('adult', profile.sex, bmi, null, bodyFatPercent),
  };
}
