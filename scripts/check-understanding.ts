/**
 * 音声入力の理解度を確かめるスクリプト。
 * iPhone の音声認識が実際に返しそうな、句読点の少ない話し言葉で試す。
 * npm run understand で実行する。
 */
import { parseSpokenMeal } from '../src/logic/parseSpokenMeal';

type Case = {
  utterance: string;
  /** 拾えていてほしい食品名 */
  expect: string[];
  /** 拾ってほしくない食品名（二重計上の検出用） */
  reject?: string[];
  /** 食品名 → 期待するグラム数 */
  grams?: Record<string, number>;
};

const CASES: Case[] = [
  { utterance: '朝ごはんは食パン2枚と目玉焼きとコーヒーです', expect: ['食パン', '目玉焼き', 'コーヒー'], grams: { 食パン: 120 } },
  { utterance: 'お昼はコンビニのおにぎり2個とサラダ食べました', expect: ['おにぎり', 'サラダ'], grams: { おにぎり: 220 } },
  { utterance: '夜はカレーライスとサラダ', expect: ['カレーライス', 'サラダ'] },
  { utterance: '牛乳200ミリリットル飲んだ', expect: ['牛乳'], grams: { 牛乳: 200 } },
  { utterance: 'ヨーグルトとバナナ', expect: ['ヨーグルト', 'バナナ'] },
  { utterance: 'そばを1杯', expect: ['そば'] },
  { utterance: '豚の生姜焼き', expect: ['生姜焼き'], reject: ['豚ロース'] },
  { utterance: '味噌汁とご飯とさばの塩焼き', expect: ['味噌汁', 'ごはん', 'さば'] },
  { utterance: 'アイス食べちゃった', expect: ['アイスクリーム'] },
  { utterance: 'えーとお昼はラーメン食べました', expect: ['ラーメン'] },
  { utterance: 'ポテトチップス1袋', expect: ['ポテトチップス'], grams: { ポテトチップス: 60 } },
  { utterance: '卵かけご飯', expect: ['卵', 'ごはん'] },
  { utterance: 'ごはん軽く1杯', expect: ['ごはん'], grams: { ごはん: 105 } },
  { utterance: 'トースト1枚とゆで卵1個', expect: ['食パン', '卵'], grams: { 卵: 50 } },
  { utterance: 'プロテイン飲んだ', expect: ['プロテイン'] },
  { utterance: '白米お茶碗1杯', expect: ['ごはん'], grams: { ごはん: 150 } },
  { utterance: '野菜炒めとご飯大盛り', expect: ['野菜炒め', 'ごはん'], grams: { ごはん: 225, 野菜炒め: 200 } },
  { utterance: '豆腐半丁', expect: ['木綿豆腐'], grams: { 木綿豆腐: 150 } },
  { utterance: 'サーモンのお刺身', expect: ['刺身'], reject: ['鮭'] },
  { utterance: 'ビール2本', expect: ['ビール'], grams: { ビール: 700 } },
  { utterance: 'うどん1玉', expect: ['うどん'], grams: { うどん: 250 } },
  { utterance: '鶏の唐揚げを5個食べました', expect: ['唐揚げ'], grams: { 唐揚げ: 167 } },
  { utterance: '納豆ご飯と味噌汁', expect: ['納豆', 'ごはん', '味噌汁'] },
  { utterance: 'コーヒーにミルク入れて飲みました', expect: ['コーヒー'] },
  { utterance: 'さつまいも半分', expect: ['さつまいも'], grams: { さつまいも: 50 } },
  { utterance: 'ブロッコリーとゆで卵のサラダ', expect: ['ブロッコリー', '卵', 'サラダ'] },
  { utterance: '焼き鮭定食', expect: ['鮭の塩焼き'] },
  { utterance: 'チーズ2個とワイン', expect: ['チーズ', 'ワイン'], grams: { チーズ: 36 } },
  { utterance: 'お寿司10貫', expect: ['寿司'], grams: { 寿司: 220 } },
  { utterance: 'とんかつ定食ごはん大盛り', expect: ['とんかつ', 'ごはん'] },
  { utterance: 'みかん3個食べた', expect: ['みかん'], grams: { みかん: 240 } },
  { utterance: 'カフェラテとクロワッサン', expect: ['カフェラテ', 'クロワッサン'] },
  { utterance: '鶏むね肉200グラム', expect: ['鶏むね肉'], grams: { 鶏むね肉: 200 } },
  { utterance: '醤油ラーメン', expect: ['ラーメン'], reject: ['サラダ油'] },
  { utterance: '玄米ごはん一膳', expect: ['玄米ごはん'], reject: ['ごはん'], grams: { 玄米ごはん: 150 } },
];

let failures = 0;
const missingFoods = new Set<string>();

for (const testCase of CASES) {
  const parsed = parseSpokenMeal(testCase.utterance);
  const names = parsed.items.map((item) => item.name);
  const problems: string[] = [];

  for (const expected of testCase.expect) {
    if (!names.includes(expected)) {
      problems.push(`「${expected}」を拾えていない`);
      missingFoods.add(expected);
    }
  }
  for (const rejected of testCase.reject ?? []) {
    if (names.includes(rejected)) problems.push(`「${rejected}」を余計に拾っている`);
  }
  for (const [name, expectedGrams] of Object.entries(testCase.grams ?? {})) {
    const item = parsed.items.find((entry) => entry.name === name);
    if (item && item.grams !== expectedGrams) {
      problems.push(`${name} が ${item.grams}g（期待 ${expectedGrams}g）`);
    }
  }

  const detail = parsed.items.map((item) => `${item.name}${item.grams}g`).join(' / ') || '（なし）';
  const unmatched = parsed.unmatchedSegments.length
    ? `　拾えなかった語: ${parsed.unmatchedSegments.join('|')}`
    : '';

  if (problems.length === 0) {
    console.log(`  OK 「${testCase.utterance}」→ ${detail}`);
  } else {
    failures += 1;
    console.log(`NG   「${testCase.utterance}」→ ${detail}${unmatched}`);
    for (const problem of problems) console.log(`       ・${problem}`);
  }
}

console.log(`\n${CASES.length}件中 ${CASES.length - failures}件が期待どおり。`);
if (missingFoods.size > 0) {
  console.log(`辞書に無いか拾えない食品: ${[...missingFoods].join('、')}`);
}
process.exit(failures === 0 ? 0 : 1);
