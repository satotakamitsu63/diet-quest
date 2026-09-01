import type { ActivityLevel, Sex } from '../data/dietaryReference';
import type { Nutrients } from '../data/nutrients';

import type { AwardCategory, AwardScale, ClubKey } from '../data/clubs';

export type CharacterSpecies =
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'bear'
  | 'penguin'
  | 'dragon';

export const SPECIES_LABELS: Record<CharacterSpecies, string> = {
  cat: 'ねこ',
  dog: 'いぬ',
  rabbit: 'うさぎ',
  bear: 'くま',
  penguin: 'ぺんぎん',
  dragon: 'ドラゴン',
};

export const SPECIES_KEYS: CharacterSpecies[] = ['cat', 'dog', 'rabbit', 'bear', 'penguin', 'dragon'];

/** 受賞歴。対戦の評価点になる。 */
export type Award = {
  id: string;
  title: string;
  category: AwardCategory;
  scale: AwardScale;
  /** 受賞した年。分からなければ null */
  year: number | null;
};

export type ActivityLevelValue = ActivityLevel;

/**
 * 目標体型のプリセット。
 * - health:   健康維持（BMI 22 の標準体重）
 * - ideal:    理想体型（見た目の理想。標準体重よりやや絞る）
 * - athletic: アスリート体型（体脂肪を落とし筋量を保つ）
 * - physique: フィジーク・審美系（体脂肪率を主軸にした仕上がり重視）
 * - custom:   自分で目標BMIを決める（下限 18.5）
 * 18歳未満には適用しない。
 */
export type GoalPreset = 'health' | 'ideal' | 'athletic' | 'physique' | 'custom';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '朝ごはん',
  lunch: '昼ごはん',
  dinner: '晩ごはん',
  snack: '間食',
};

export type Profile = {
  id: string;
  groupId: string;
  /** このプロフィールを作ったアカウントの ID。共有していないときは null */
  ownerId: string | null;
  displayName: string;
  /** 生年月日。未入力なら ageYears を使う */
  birthDate: string | null;
  ageYears: number | null;
  sex: Sex;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  isMenstruating: boolean;
  goalPreset: GoalPreset;
  /** 自分で決めた目標体重(kg)。身長と合わせて目標BMIに換算する */
  customTargetWeightKg: number | null;
  /** 身長が未入力のときの控えとして残している目標BMI */
  customTargetBmi: number | null;
  customTargetBodyFatPercent: number | null;
  /** バレエなど審美系・持久系の競技をしている場合。体重目標を持たせずエネルギーと骨の材料を厚くする */
  aestheticSportMode: boolean;
  /** 成長期ブースト。たんぱく質・カルシウム・ビタミンDの目標を推奨量より厚めにする（18歳未満のみ） */
  growthBoost: boolean;
  /** 父の身長(cm)。予測成人身長の計算に使う */
  fatherHeightCm: number | null;
  /** 母の身長(cm) */
  motherHeightCm: number | null;
  /** 目標にする大人になったときの身長(cm)。未設定なら両親の身長からの予測を使う */
  targetAdultHeightCm: number | null;
  species: CharacterSpecies;
  characterName: string;
  /** やっているスポーツ・部活・習い事。必殺技と得意ステータスが決まる */
  club: ClubKey;
  /** 必殺技の名前を自分で決めたい場合 */
  customSpecialMoveName: string | null;
  /** 受賞歴 */
  awards: Award[];
  createdAt: string;
};

export type BodyLog = {
  id: string;
  profileId: string;
  /** YYYY-MM-DD */
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
};

export type MealItem = {
  foodId: string;
  name: string;
  grams: number;
  /** 音声入力のどの語から作られたか（訂正しやすくするため） */
  matchedText: string;
  nutrients: Nutrients;
};

export type MealLog = {
  id: string;
  profileId: string;
  /** YYYY-MM-DD */
  date: string;
  slot: MealSlot;
  rawText: string;
  items: MealItem[];
  createdAt: string;
};

export type FamilyGroup = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type AppData = {
  group: FamilyGroup;
  profiles: Profile[];
  mealLogs: MealLog[];
  bodyLogs: BodyLog[];
  activeProfileId: string | null;
};
