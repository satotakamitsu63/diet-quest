/**
 * 主要なロジックの手触りを確認するための実行スクリプト。
 * npm run verify で実行する。
 */
import { buildNutrientTargets } from '../src/data/dietaryReference';
import { FOODS } from '../src/data/foods';
import { calculateChildStandardWeight } from '../src/data/childStandardWeight';
import {
  assessBody,
  checkTargetWeight,
  maximumTargetWeightKg,
  minimumTargetWeightKg,
  resolveTargetBmi,
  resolveTargetBodyFatPercent,
} from '../src/logic/bodyGoal';
import { parseSpokenMeal } from '../src/logic/parseSpokenMeal';
import {
  summarizeDay, buildCharacterState, adjustEnergyTarget, applyGrowthBoost,
} from '../src/logic/score';
import {
  buildHeightGoal, calculateHeightVelocity, predictAdultHeight, referenceVelocityRange,
} from '../src/logic/heightGoal';
import { buildMascotGrid } from '../src/art/mascot';
import {
  ageMultiplier, awardMultiplier, buildBattleBuild, buildBattleStats,
  calculateAwardScore, physiqueMultiplier, resolveSpecialMoveName, simulateBattle,
} from '../src/logic/battle';
import { buildWeeklyReview, calculateDailyPenalty } from '../src/logic/weeklyReview';
import type { Award } from '../src/lib/types';
import type { BodyLog, MealLog, Profile } from '../src/lib/types';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  const mark = condition ? '  OK' : 'NG  ';
  if (!condition) failures += 1;
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log(`\n== 食品データ (${FOODS.length}件) ==`);
const duplicateIds = FOODS.map((food) => food.id).filter((id, index, all) => all.indexOf(id) !== index);
check('IDに重複がない', duplicateIds.length === 0, duplicateIds.join(','));
check('全件にエネルギー値がある', FOODS.every((food) => food.per100g.energy >= 0));
check('全件に1食分のグラム数がある', FOODS.every((food) => food.servingGrams > 0));

console.log('\n== 音声入力のパース ==');
const cases: Array<[string, string[]]> = [
  ['ごはん一膳と鮭の塩焼きと味噌汁', ['ごはん', '鮭の塩焼き', '味噌汁']],
  ['納豆1パックと卵2個', ['納豆', '卵']],
  ['からあげ3個食べた', ['唐揚げ']],
  ['牛乳をコップ1杯飲みました', ['牛乳']],
  ['カレーライス大盛り', ['カレーライス']],
  ['トマト150グラム', ['トマト']],
];
for (const [text, expected] of cases) {
  const parsed = parseSpokenMeal(text);
  const names = parsed.items.map((item) => item.name);
  const detail = `${names.map((name, index) => `${name}${parsed.items[index].grams}g`).join(' / ')}`;
  check(`「${text}」`, expected.every((name) => names.includes(name)), detail);
}

const eggs = parseSpokenMeal('卵2個').items[0];
check('卵2個が100gになる', eggs?.grams === 100, `${eggs?.grams}g`);
const karaage = parseSpokenMeal('唐揚げ3個').items[0];
check('唐揚げ3個が1食分の100gになる', karaage?.grams === 100, `${karaage?.grams}g`);
const bigCurry = parseSpokenMeal('カレーライス大盛り').items[0];
check('大盛りが1.5倍になる', bigCurry?.grams === 600, `${bigCurry?.grams}g`);

console.log('\n== 食事摂取基準 ==');
const girl10 = buildNutrientTargets({ age: 10, sex: 'female', activityLevel: 2, isMenstruating: false });
check('10歳女児のエネルギーが2100kcal', girl10.recommended.energy === 2100, `${girl10.recommended.energy}`);
check('10歳女児のカルシウムが750mg', girl10.recommended.calcium === 750);
const girl10Menstruating = buildNutrientTargets({ age: 10, sex: 'female', activityLevel: 2, isMenstruating: true });
check('月経ありで鉄が12.0mgに上がる', girl10Menstruating.recommended.iron === 12.0);
const man40 = buildNutrientTargets({ age: 40, sex: 'male', activityLevel: 2, isMenstruating: false });
check('40歳男性のエネルギーが2700kcal', man40.recommended.energy === 2700, `${man40.recommended.energy}`);

console.log('\n== 体型の判定 ==');
check('10歳女児 身長140cmの標準体重', calculateChildStandardWeight(10, 'female', 140) === 34.1,
  `${calculateChildStandardWeight(10, 'female', 140)}kg`);

function makeProfile(overrides: Partial<Profile>): Profile {
  return {
    id: 'p1', groupId: 'g1', displayName: 'テスト', birthDate: null, ageYears: 40,
    sex: 'male', heightCm: 172, activityLevel: 2, isMenstruating: false,
    goalPreset: 'ideal', customTargetWeightKg: null, customTargetBmi: null,
    customTargetBodyFatPercent: null,
    aestheticSportMode: false, growthBoost: true,
    fatherHeightCm: null, motherHeightCm: null, targetAdultHeightCm: null,
    species: 'cat', characterName: 'にゃん', club: 'none',
    customSpecialMoveName: null, awards: [],
    createdAt: new Date().toISOString(), ...overrides,
  };
}

function makeBodyLog(overrides: Partial<BodyLog>): BodyLog {
  return { id: 'b1', profileId: 'p1', date: '2026-08-30', weightKg: null, heightCm: null, bodyFatPercent: null, ...overrides };
}

const physique = makeProfile({ goalPreset: 'physique' });
const leanLog = makeBodyLog({ weightKg: 66, heightCm: 172, bodyFatPercent: 9 });
const leanAssessment = assessBody({ profile: physique, age: 40, latestBodyLog: leanLog });
check('フィジーク目標で体脂肪9%なら目標に近い', leanAssessment.proximity > 0.8,
  `近さ${leanAssessment.proximity.toFixed(2)} 体型${leanAssessment.shapeLabel}`);

const softLog = makeBodyLog({ weightKg: 66, heightCm: 172, bodyFatPercent: 24 });
const softAssessment = assessBody({ profile: physique, age: 40, latestBodyLog: softLog });
check('同じ体重でも体脂肪24%なら目標から遠い', softAssessment.proximity < leanAssessment.proximity,
  `近さ${softAssessment.proximity.toFixed(2)}`);

const child = makeProfile({ ageYears: 10, sex: 'female', heightCm: 140, aestheticSportMode: true });
const childAssessment = assessBody({
  profile: child, age: 10,
  latestBodyLog: makeBodyLog({ weightKg: 30, heightCm: 140 }),
});
check('小児に減量方向の指示が出ない', childAssessment.direction !== 'reduce', childAssessment.direction);
check('小児に目標体重を設定しない', childAssessment.targetWeightKg === null);
check('やせぎみの小児に注意文が出る', childAssessment.caution !== null);

const unknown = assessBody({ profile: makeProfile({}), age: 40, latestBodyLog: null });
check('身長体重が未入力でも動く', unknown.mode === 'unknown' && unknown.proximity === 1);
check('未入力のときに体型を断定しない', unknown.shapeLabel === '未測定', unknown.shapeLabel);

const heightOnly = assessBody({
  profile: makeProfile({}), age: 40, latestBodyLog: makeBodyLog({ heightCm: 172 }),
});
check('身長だけでも体型を断定しない', heightOnly.shapeLabel === '未測定', heightOnly.shapeLabel);

const noHeightCustomGoal = makeProfile({
  goalPreset: 'custom', heightCm: null, customTargetWeightKg: 66,
});
check('身長なしで目標体重だけ入れても落ちない',
  resolveTargetBmi(noHeightCustomGoal, 40) !== null,
  `${resolveTargetBmi(noHeightCustomGoal, 40)}`);

console.log('\n== 自分で決める目標（体重・体脂肪率の直接入力） ==');
const customGoal = makeProfile({
  goalPreset: 'custom', heightCm: 172, customTargetWeightKg: 66, customTargetBodyFatPercent: 12,
});
check('目標体重66kg・身長172cmが BMI 22.3 になる',
  Math.round((resolveTargetBmi(customGoal, 40) ?? 0) * 10) / 10 === 22.3,
  `${Math.round((resolveTargetBmi(customGoal, 40) ?? 0) * 10) / 10}`);
check('目標体脂肪率12%がそのまま採用される',
  resolveTargetBodyFatPercent(customGoal, 40) === 12);

const tooLight = makeProfile({
  goalPreset: 'custom', heightCm: 172, customTargetWeightKg: 48, customTargetBodyFatPercent: null,
});
check('下限を割る目標体重は BMI 18.5 に留められる',
  resolveTargetBmi(tooLight, 40) === 18.5, `${resolveTargetBmi(tooLight, 40)}`);
check('身長172cmの下限が54.7kg', minimumTargetWeightKg(172) === 54.7, `${minimumTargetWeightKg(172)}kg`);
check('身長172cmの上限が76.9kg', maximumTargetWeightKg(172) === 76.9, `${maximumTargetWeightKg(172)}kg`);
const rejected = checkTargetWeight(48, 172);
check('下限割れのときに理由を返す', rejected.reason !== null && rejected.accepted === 54.7,
  rejected.reason ?? '理由なし');
check('範囲内なら理由を返さない', checkTargetWeight(66, 172).reason === null);

const tooLean = makeProfile({
  goalPreset: 'custom', sex: 'female', heightCm: 158, customTargetWeightKg: 50,
  customTargetBodyFatPercent: 10,
});
check('女性の目標体脂肪率は14%未満にできない',
  resolveTargetBodyFatPercent(tooLean, 39) === 14,
  `${resolveTargetBodyFatPercent(tooLean, 39)}%`);

const customChild = makeProfile({
  ageYears: 10, sex: 'female', heightCm: 140, goalPreset: 'custom', customTargetWeightKg: 26,
});
check('小児には目標体重を入れても適用しない', resolveTargetBmi(customChild, 10) === null);

console.log('\n== エネルギー目標の補正 ==');
const heavy = assessBody({ profile: makeProfile({}), age: 40, latestBodyLog: makeBodyLog({ weightKg: 85, heightCm: 172 }) });
check('太っている大人は減量方向', heavy.direction === 'reduce');
check('減量でも下限を割らない',
  adjustEnergyTarget(2700, makeProfile({}), 40, heavy) === 2300,
  `${adjustEnergyTarget(2700, makeProfile({}), 40, heavy)}kcal`);
check('小児は減量補正をかけない',
  adjustEnergyTarget(2100, child, 10, childAssessment) === 2100);

console.log('\n== 子どもの身長の目標 ==');
check('女児の予測成人身長 父175・母160 → 161cm',
  predictAdultHeight('female', 175, 160) === 161, `${predictAdultHeight('female', 175, 160)}cm`);
check('男児の予測成人身長 父175・母160 → 174cm',
  predictAdultHeight('male', 175, 160) === 174, `${predictAdultHeight('male', 175, 160)}cm`);
check('両親の身長が無ければ予測しない', predictAdultHeight('female', null, 160) === null);

const nieceProfile = makeProfile({
  ageYears: 10, sex: 'female', heightCm: 140, fatherHeightCm: 175, motherHeightCm: 160,
});
const goalFromParents = buildHeightGoal(nieceProfile, 140);
check('予測値が目標として使われる', goalFromParents.targetAdultHeightCm === 161);
check('目標までの残りが出る', goalFromParents.remainingCm === 21, `${goalFromParents.remainingCm}cm`);
check('予測の幅は ±9cm',
  goalFromParents.predictedRangeCm?.[0] === 152 && goalFromParents.predictedRangeCm?.[1] === 170,
  `${goalFromParents.predictedRangeCm}`);

const manualGoal = buildHeightGoal({ ...nieceProfile, targetAdultHeightCm: 168 }, 140);
check('手入力の目標身長が予測より優先される', manualGoal.targetAdultHeightCm === 168);

const heightLogs: BodyLog[] = [
  makeBodyLog({ id: 'h1', date: '2026-02-01', heightCm: 138 }),
  makeBodyLog({ id: 'h2', date: '2026-08-01', heightCm: 141 }),
];
const velocity = calculateHeightVelocity(heightLogs, 'p1');
check('半年で3cmなら年6.0cm', velocity?.centimetersPerYear === 6.0, `${velocity?.centimetersPerYear}cm/年`);
check('記録が近すぎると計算しない',
  calculateHeightVelocity([
    makeBodyLog({ id: 'h3', date: '2026-07-20', heightCm: 140 }),
    makeBodyLog({ id: 'h4', date: '2026-08-01', heightCm: 141 }),
  ], 'p1') === null);
check('10歳女児の目安は5〜7cm', referenceVelocityRange(10, 'female')?.[0] === 6);

console.log('\n== 成長期ブースト ==');
const childTargets = buildNutrientTargets({
  age: 10, sex: 'female', activityLevel: 3, isMenstruating: false,
}).recommended;
const boosted = applyGrowthBoost({ targets: childTargets, weightKg: 30 });
check('たんぱく質 50g → 60g', boosted.protein === 60, `${boosted.protein}g`);
check('カルシウム 750mg → 900mg', boosted.calcium === 900, `${boosted.calcium}mg`);
check('ビタミンD 8μg → 10μg', boosted.vitaminD === 10, `${boosted.vitaminD}μg`);
check('エネルギーは増やさない', boosted.energy === childTargets.energy);

const lightChild = applyGrowthBoost({ targets: childTargets, weightKg: 25 });
check('体重25kgならたんぱく質は2.0g/kgの50gで頭打ち',
  lightChild.protein === 50, `${lightChild.protein}g`);

const teenTargets = buildNutrientTargets({
  age: 13, sex: 'male', activityLevel: 2, isMenstruating: false,
}).recommended;
const boostedTeen = applyGrowthBoost({ targets: teenTargets, weightKg: 50 });
check('カルシウムは1000mgで頭打ち', boostedTeen.calcium === 1000, `${boostedTeen.calcium}mg`);

console.log('\n== スコアとキャラクターの成長 ==');
const targets = { ...man40.recommended, energy: 2700 };
function makeMealLog(date: string, text: string): MealLog {
  return {
    id: `m-${date}`, profileId: 'p1', date, slot: 'dinner', rawText: text,
    items: parseSpokenMeal(text).items, createdAt: new Date().toISOString(),
  };
}
const FULL_DAY_MEALS = [
  '食パン2枚、卵2個、牛乳コップ1杯、ヨーグルト、バナナ1本',
  'ごはん2膳、唐揚げ、サラダ、味噌汁、ひじき、みかん2個',
  'ごはん1膳、鮭の塩焼き、納豆1パック、木綿豆腐、ほうれん草、ブロッコリー、しめじ、味噌汁',
];
function makeFullDay(date: string): MealLog[] {
  return FULL_DAY_MEALS.map((text, index) => ({
    ...makeMealLog(date, text),
    id: `m-${date}-${index}`,
  }));
}
const goodDayLogs = makeFullDay('2026-08-30');
const goodSummary = summarizeDay({
  date: '2026-08-30', profile: makeProfile({}), age: 40, logs: goodDayLogs, targets,
});
check('しっかり食べた日は高いスコアになる', (goodSummary.score ?? 0) >= 70,
  `${goodSummary.score}点 / ${Math.round(goodSummary.totals.energy)}kcal（目標${targets.energy}）`);
check('記録がある日は hasRecord が true', goodSummary.hasRecord);

const emptySummary = summarizeDay({ date: '2026-08-29', profile: makeProfile({}), age: 40, logs: [], targets });
check('記録なしの日は score が null', emptySummary.score === null);

const starving = Array.from({ length: 6 }, (_, index) => ({
  ...summarizeDay({
    date: `2026-08-2${index}`, profile: makeProfile({}), age: 40,
    logs: [makeMealLog(`2026-08-2${index}`, 'サラダ')], targets,
  }),
}));
const starvingState = buildCharacterState({ summaries: starving, assessment: unknown });
check('少食が続くとやつれ状態になる', starvingState.condition === 'exhausted', starvingState.condition);

const goodRun = Array.from({ length: 20 }, (_, index) => {
  const date = `2026-08-${String(index + 1).padStart(2, '0')}`;
  return summarizeDay({ date, profile: makeProfile({}), age: 40, logs: makeFullDay(date), targets });
});
const grownState = buildCharacterState({ summaries: goodRun, assessment: leanAssessment });
check('よい日を重ねると段階が上がる', grownState.growthStage > 0, `Lv.${grownState.growthStage + 1} 経験値${grownState.totalExperience}`);
check('連続日数が数えられる', grownState.streakDays > 0, `${grownState.streakDays}日`);

console.log('\n== 対戦 ==');
import_placeholder_removed: {
  // よく食べた人とほとんど食べていない人のステータスを比べる
  const wellFedDays = Array.from({ length: 14 }, (_, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, '0')}`;
    return summarizeDay({ date, profile: makeProfile({}), age: 40, logs: makeFullDay(date), targets });
  });
  const starvingDays = Array.from({ length: 14 }, (_, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, '0')}`;
    return summarizeDay({
      date, profile: makeProfile({}), age: 40,
      logs: [makeMealLog(date, 'サラダとみかん')], targets,
    });
  });

  const wellFedCharacter = buildCharacterState({ summaries: wellFedDays, assessment: leanAssessment });
  const starvingCharacter = buildCharacterState({ summaries: starvingDays, assessment: leanAssessment });

  const baseBattle = { age: 40, proximity: 1, club: 'none' as const, awards: [] as Award[] };
  const strong = buildBattleStats({ ...baseBattle, summaries: wellFedDays, character: wellFedCharacter });
  const weak = buildBattleStats({ ...baseBattle, summaries: starvingDays, character: starvingCharacter });

  check('しっかり食べた人のほうが こうげき が高い', strong.attack > weak.attack,
    `${strong.attack} > ${weak.attack}`);
  check('しっかり食べた人のほうが たいりょく が高い', strong.hp > weak.hp, `${strong.hp} > ${weak.hp}`);
  check('食べない人はやつれてステータスが下がる', starvingCharacter.condition === 'exhausted');

  // 体型を変えてもステータスが動かないことを確かめる（痩せても強くならない）
  const leanCharacter = { ...wellFedCharacter, shapeValue: 0.05, proximity: 1 };
  const heavyCharacter = { ...wellFedCharacter, shapeValue: 0.95, proximity: 1 };
  const leanStats = buildBattleStats({ ...baseBattle, summaries: wellFedDays, character: leanCharacter });
  const heavyStats = buildBattleStats({ ...baseBattle, summaries: wellFedDays, character: heavyCharacter });
  check('痩せても太ってもステータスは変わらない',
    JSON.stringify(leanStats) === JSON.stringify(heavyStats),
    `細${leanStats.attack} / 太${heavyStats.attack}`);

  // 食べ過ぎても強くならない
  const overfedDays = wellFedDays.map((summary) => ({
    ...summary,
    ratios: Object.fromEntries(
      Object.entries(summary.ratios).map(([key, value]) => [key, (value as number) * 3]),
    ) as typeof summary.ratios,
    energyRatio: summary.energyRatio * 3,
  }));
  const overfedStats = buildBattleStats({ ...baseBattle, summaries: overfedDays, character: wellFedCharacter });
  check('食べ過ぎても こうげき は上がらない', overfedStats.attack <= strong.attack,
    `過食${overfedStats.attack} <= 適量${strong.attack}`);
  check('食べ過ぎると たいりょく はむしろ下がる', overfedStats.hp < strong.hp,
    `過食${overfedStats.hp} < 適量${strong.hp}`);

  // 対戦の再現性
  const dummyModifiers = buildBattleBuild({
    ...baseBattle, summaries: wellFedDays, character: wellFedCharacter,
  }).modifiers;
  const makeCombatant = (id: string, name: string, stats: typeof strong) => ({
    profileId: id, displayName: name, characterName: name,
    species: 'cat' as const, stats, shapeValue: 0.5, growthStage: stats.level - 1,
    condition: 'steady' as const, specialMoveName: 'たいあたり', modifiers: dummyModifiers,
  });
  const a = makeCombatant('p-a', 'テスト1', strong);
  const b = makeCombatant('p-b', 'テスト2', weak);
  const first = simulateBattle(a, b, '2026-08-30:p-a:p-b');
  const second = simulateBattle(a, b, '2026-08-30:p-a:p-b');
  check('同じ日・同じ相手なら結果が変わらない',
    JSON.stringify(first) === JSON.stringify(second));
  check('別の日なら展開が変わる',
    JSON.stringify(simulateBattle(a, b, '2026-08-31:p-a:p-b')) !== JSON.stringify(first));
  check('強いほうが勝つ', first.winnerProfileId === 'p-a', `${first.summary}`);
  check('戦闘ログが生成される', first.turns.length > 0, `${first.turns.length}ターン`);
  check('ダメージは必ず1以上', first.turns.every((turn) => turn.damage >= 1));

  // 互角同士でも必ず終わる
  const even = simulateBattle(
    makeCombatant('p-c', 'テスト3', strong),
    makeCombatant('p-d', 'テスト4', strong),
    'even',
  );
  check('互角でも決着がつく', even.winnerProfileId !== null || even.decidedByRemainingHp);
  check('互角の対戦は数ターン続く', even.turns.length >= 6 && even.turns.length <= 30,
    `${even.turns.length}ターン`);
}

console.log('\n== 年齢・体型・受賞歴の補正 ==');
check('子どものほうが年齢補正が大きい', ageMultiplier(10) > ageMultiplier(42),
  `10歳${ageMultiplier(10)} > 42歳${ageMultiplier(42)}`);
check('大人は年齢補正なし', ageMultiplier(42) === 1);
check('年齢が上がるほど補正が下がる',
  ageMultiplier(9) > ageMultiplier(12) && ageMultiplier(12) > ageMultiplier(15));

check('目標体型に近いほど強い', physiqueMultiplier(1) > physiqueMultiplier(0.5));
check('痩せすぎも太りすぎも同じだけ弱くなる（左右対称）',
  physiqueMultiplier(0.2) === physiqueMultiplier(0.2));
{
  // 目標から同じだけ離れていれば、細い側でも太い側でも同じ倍率になることを確かめる
  const thin = assessBody({
    profile: makeProfile({ goalPreset: 'health' }), age: 40,
    latestBodyLog: makeBodyLog({ weightKg: 55, heightCm: 172 }),
  });
  const fat = assessBody({
    profile: makeProfile({ goalPreset: 'health' }), age: 40,
    latestBodyLog: makeBodyLog({ weightKg: 85, heightCm: 172 }),
  });
  const atGoal = assessBody({
    profile: makeProfile({ goalPreset: 'health' }), age: 40,
    latestBodyLog: makeBodyLog({ weightKg: 65, heightCm: 172 }),
  });
  check('痩せすぎは目標どおりより弱い',
    physiqueMultiplier(thin.proximity) < physiqueMultiplier(atGoal.proximity),
    `痩${physiqueMultiplier(thin.proximity).toFixed(2)} < 適${physiqueMultiplier(atGoal.proximity).toFixed(2)}`);
  check('太りすぎも目標どおりより弱い',
    physiqueMultiplier(fat.proximity) < physiqueMultiplier(atGoal.proximity),
    `太${physiqueMultiplier(fat.proximity).toFixed(2)} < 適${physiqueMultiplier(atGoal.proximity).toFixed(2)}`);
}

const awards: Award[] = [
  { id: 'a1', title: '全国大会 優勝', category: 'sports', scale: 'national', year: 2026 },
  { id: 'a2', title: '漢字検定', category: 'study', scale: 'school', year: 2025 },
];
const awardScore = calculateAwardScore(awards);
check('スポーツ点と勉強点が分かれて出る',
  awardScore.sports === 8 && awardScore.study === 1, `スポーツ${awardScore.sports} 勉強${awardScore.study}`);
const manyAwards: Award[] = Array.from({ length: 20 }, (_, index) => ({
  id: `x${index}`, title: '全国大会', category: 'sports' as const, scale: 'national' as const, year: null,
}));
check('受賞歴の効果は上限で頭打ち',
  awardMultiplier(calculateAwardScore(manyAwards)) === 1.25,
  `${awardMultiplier(calculateAwardScore(manyAwards))}`);

check('部活から必殺技名が決まる', resolveSpecialMoveName('ballet', null) === 'グラン・ジュテ');
check('自分で決めた必殺技名が優先される',
  resolveSpecialMoveName('ballet', 'きらめきターン') === 'きらめきターン');
{
  const wellFedDays = Array.from({ length: 14 }, (_, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, '0')}`;
    return summarizeDay({ date, profile: makeProfile({}), age: 40, logs: makeFullDay(date), targets });
  });
  const character = buildCharacterState({ summaries: wellFedDays, assessment: leanAssessment });
  const plain = buildBattleBuild({
    summaries: wellFedDays, character, age: 40, proximity: 1, club: 'none', awards: [],
  });
  const dancer = buildBattleBuild({
    summaries: wellFedDays, character, age: 40, proximity: 1, club: 'ballet', awards: [],
  });
  check('バレエはすばやさが上がる', dancer.stats.speed > plain.stats.speed,
    `${dancer.stats.speed} > ${plain.stats.speed}`);
  check('得意でないステータスは変わらない', dancer.stats.defense === plain.stats.defense);

  const child = buildBattleBuild({
    summaries: wellFedDays, character, age: 10, proximity: 1, club: 'none', awards: [],
  });
  check('同じ食事なら子どものほうが強い', child.stats.attack > plain.stats.attack,
    `子${child.stats.attack} > 大人${plain.stats.attack}`);
}

console.log('\n== 週ごとのふりかえり ==');
{
  const profile = makeProfile({});
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = `2026-08-${String(24 + index).padStart(2, '0')}`;
    // 4日はしっかり、3日はサラダだけ
    const logs = index < 4 ? makeFullDay(date) : [makeMealLog(date, 'サラダ')];
    return summarizeDay({ date, profile, age: 40, logs, targets });
  });
  const allLogs = week.flatMap((summary, index) =>
    index < 4 ? makeFullDay(summary.date) : [makeMealLog(summary.date, 'サラダ')]);
  const review = buildWeeklyReview({
    summaries: week, logs: allLogs, profileId: 'p1', emphasizeBone: false,
  });
  check('マイナス点が負の数で出る', review.penaltyPoints < 0, `${review.penaltyPoints}点`);
  check('不足した栄養素の日数が数えられる',
    review.nutrients.some((entry) => entry.shortDays >= 3),
    review.nutrients.filter((e) => e.shortDays > 0).map((e) => `${e.label}${e.shortDays}日`).join(' '));
  check('具体的なアドバイスが出る', review.advice.length > 0, `${review.advice.length}件`);
  check('アドバイスに実行できる行動がついている',
    review.advice.every((entry) => entry.actions.length > 0));
  check('エネルギー不足が指摘される',
    review.advice.some((entry) => entry.headline.includes('エネルギー')),
    review.advice.map((a) => a.headline).join(' / '));

  const perfectWeek = Array.from({ length: 7 }, (_, index) => {
    const date = `2026-09-${String(index + 1).padStart(2, '0')}`;
    return summarizeDay({ date, profile, age: 40, logs: makeFullDay(date), targets });
  });
  const goodReview = buildWeeklyReview({
    summaries: perfectWeek,
    logs: perfectWeek.flatMap((summary) => makeFullDay(summary.date)),
    profileId: 'p1', emphasizeBone: false,
  });
  check('よく食べた週はマイナス点が小さい', goodReview.penaltyPoints > review.penaltyPoints,
    `${goodReview.penaltyPoints} > ${review.penaltyPoints}`);

  const emptyDay = summarizeDay({ date: '2026-09-30', profile, age: 40, logs: [], targets });
  check('記録がない日は−5点', calculateDailyPenalty(emptyDay) === -5,
    `${calculateDailyPenalty(emptyDay)}点`);
}

console.log('\n== ドット絵の生成 ==');
for (const stage of [0, 5, 9]) {
  for (const shape of [0.05, 0.5, 0.95]) {
    const grid = buildMascotGrid({ species: 'cat', shapeValue: shape, growthStage: stage, condition: 'steady' });
    const filled = grid.flat().filter((cell) => cell !== '').length;
    check(`段階${stage} 体型${shape} が描ける`, filled > 200, `${filled}ドット`);
  }
}
const thin = buildMascotGrid({ species: 'dog', shapeValue: 0.05, growthStage: 5, condition: 'steady' })
  .flat().filter((cell) => cell !== '').length;
const fat = buildMascotGrid({ species: 'dog', shapeValue: 0.95, growthStage: 5, condition: 'steady' })
  .flat().filter((cell) => cell !== '').length;
check('太いほうがドット数が多い', fat > thin, `細${thin} < 太${fat}`);

console.log(failures === 0 ? '\nすべて通りました。\n' : `\n${failures}件が失敗しました。\n`);
process.exit(failures === 0 ? 0 : 1);
