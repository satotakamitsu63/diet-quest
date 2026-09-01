/**
 * デバッグ用のデモデータを作る。実際のパーサを通して食事の栄養を埋める。
 * 出力先は dist/demo-data.json。動作確認のときだけ使う。
 */
import { writeFileSync } from 'node:fs';
import { flattenParsedMeal, parseSpokenMeal } from '../src/logic/parseSpokenMeal';
import type { AppData, MealLog, Profile } from '../src/lib/types';

const now = new Date().toISOString();
const groupId = 'g-demo';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeProfile(overrides: Partial<Profile> & Pick<Profile, 'id' | 'displayName' | 'characterName'>): Profile {
  return {
    groupId, birthDate: null, ageYears: 40, sex: 'male', heightCm: 170, activityLevel: 2,
    isMenstruating: false, goalPreset: 'ideal', customTargetWeightKg: null, customTargetBmi: null,
    customTargetBodyFatPercent: null, aestheticSportMode: false, growthBoost: true,
    fatherHeightCm: null, motherHeightCm: null, targetAdultHeightCm: null,
    species: 'cat', createdAt: now, ...overrides,
  } as Profile;
}

const MENUS: Record<string, string[]> = {
  'p-a': [
    '食パン2枚、卵2個、牛乳コップ1杯、ヨーグルト、バナナ1本',
    'ごはん2膳、唐揚げ、サラダ、味噌汁、ひじき、みかん2個',
    'ごはん1膳、鮭の塩焼き、納豆1パック、木綿豆腐、ほうれん草、ブロッコリー、しめじ、味噌汁',
  ],
  'p-b': [
    'ヨーグルト、コーヒー',
    'おにぎり1個とサラダ',
    'ごはん1膳、味噌汁、冷奴、ほうれん草',
  ],
};

const mealLogs: MealLog[] = [];
for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  for (const profileId of Object.keys(MENUS)) {
    MENUS[profileId].forEach((text, index) => {
      mealLogs.push({
        id: `m-${profileId}-${dateKey(date)}-${index}`,
        profileId,
        date: dateKey(date),
        slot: (['breakfast', 'lunch', 'dinner'] as const)[index],
        rawText: text,
        items: flattenParsedMeal(parseSpokenMeal(text)),
        createdAt: now,
      });
    });
  }
}

const today = dateKey(new Date());
const data: AppData = {
  group: { id: groupId, name: 'わが家', inviteCode: 'K7QM2X', createdAt: now },
  profiles: [
    makeProfile({ id: 'p-a', displayName: 'サンプルA', characterName: 'くろまる', ageYears: 42, heightCm: 172, sex: 'male' }),
    makeProfile({ id: 'p-b', displayName: 'サンプルB', characterName: 'しろまる', ageYears: 39, heightCm: 158, sex: 'female', species: 'dog', isMenstruating: true }),
  ],
  mealLogs,
  bodyLogs: [
    { id: 'b1', profileId: 'p-a', date: today, weightKg: 71, heightCm: 172, bodyFatPercent: 17 },
    { id: 'b2', profileId: 'p-b', date: today, weightKg: 56, heightCm: 158, bodyFatPercent: 27 },
  ],
  activeProfileId: 'p-a',
};

writeFileSync('dist/demo-data.json', JSON.stringify(data), 'utf-8');
const items = mealLogs.reduce((total, log) => total + log.items.length, 0);
console.log(`dist/demo-data.json を作成（食事記録 ${mealLogs.length}件 / 食品 ${items}件）`);
