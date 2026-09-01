import { FOODS, type Food } from '../data/foods';
import { scaleNutrients } from '../data/nutrients';
import type { MealItem, MealSlot } from '../lib/types';

const KANJI_DIGITS: Record<string, number> = {
  〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「二十三」のような漢数字を算用数字に置き換える（1〜99のみ対応）。 */
function replaceKanjiNumbers(text: string): string {
  return text.replace(/[〇零一二三四五六七八九十]+/g, (match) => {
    const tensIndex = match.indexOf('十');
    if (tensIndex === -1) {
      let value = 0;
      for (const character of match) value = value * 10 + (KANJI_DIGITS[character] ?? 0);
      return String(value);
    }
    const tensPart = match.slice(0, tensIndex);
    const onesPart = match.slice(tensIndex + 1);
    const tens = tensPart === '' ? 1 : KANJI_DIGITS[tensPart] ?? 1;
    const ones = onesPart === '' ? 0 : KANJI_DIGITS[onesPart] ?? 0;
    return String(tens * 10 + ones);
  });
}

/**
 * 照合用に文字をそろえる。
 * 文字を消すと元の位置がずれて数量との対応が取れなくなるため、置き換えだけを行う。
 */
function normalizeText(text: string): string {
  return replaceKanjiNumbers(text.normalize('NFKC'))
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

type FoodToken = { token: string; food: Food };

/** 名称と別名から照合用の索引を作る。長い語を先に試すため長さ降順で並べる。 */
function buildFoodTokens(): FoodToken[] {
  const tokens: FoodToken[] = [];
  for (const food of FOODS) {
    for (const label of [food.name, ...food.aliases]) {
      const normalized = normalizeText(label);
      if (normalized.length >= 1) tokens.push({ token: normalized, food });
    }
  }
  return tokens.sort((left, right) => right.token.length - left.token.length);
}

const FOOD_TOKENS = buildFoodTokens();

type ServingUnit = { count: number; unit: string | null };

/** 「6枚切り1枚」「半丁」といった1食分の呼び方から、個数と単位を取り出す。 */
export function parseServingLabel(label: string): ServingUnit {
  const normalized = replaceKanjiNumbers(label.normalize('NFKC'));
  if (normalized.startsWith('半')) return { count: 0.5, unit: normalized.slice(1) || null };
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([^\d\s]+)$/);
  if (!match) return { count: 1, unit: null };
  return { count: Number(match[1]), unit: match[2] };
}

const AMOUNT_MODIFIERS: Array<[pattern: RegExp, multiplier: number]> = [
  [/特盛/, 2.0],
  [/大盛り?/, 1.5],
  [/たっぷり/, 1.3],
  [/小盛り?|少なめ|ちょっと|軽く/, 0.7],
  [/半分|はんぶん|はーふ/, 0.5],
  [/一口|ひとくち/, 0.25],
];

const SEGMENT_SEPARATOR = /[、。,.]|それから|そして|\sと\s/;

const TRAILING_VERBS = /(を)?(食べ|たべ|飲み|のみ|飲ん|のん)(まし|ました|た|ます|る|だ)?$/;

const COUNTER_PATTERN =
  /(\d+(?:\.\d+)?)\s*(個|本|枚|杯|膳|皿|切れ|貫|粒|房|尾|玉|袋|ぱっく|缶|丁|人前|人分|つ|串|片|かっぷ|合|かけ)/;
const GRAM_PATTERN = /(\d+(?:\.\d+)?)\s*(g|グラム|ぐらむ|ml|みりりっとる|cc)/i;

type SegmentAmount = {
  explicitGrams: number | null;
  count: number | null;
  unit: string | null;
  modifier: number;
};

function extractModifier(text: string): number {
  for (const [pattern, multiplier] of AMOUNT_MODIFIERS) {
    if (pattern.test(text)) return multiplier;
  }
  return 1;
}

/** 食品名のうしろに続く部分から分量の手がかりを取り出す。 */
function extractAmount(scope: string, fallbackScope: string): SegmentAmount {
  const gramMatch = scope.match(GRAM_PATTERN);
  const countMatch = scope.match(COUNTER_PATTERN);
  const modifier = extractModifier(scope) !== 1 ? extractModifier(scope) : extractModifier(fallbackScope);
  return {
    explicitGrams: gramMatch ? Number(gramMatch[1]) : null,
    count: countMatch ? Number(countMatch[1]) : null,
    unit: countMatch ? countMatch[2] : null,
    modifier,
  };
}

const KANJI = /[一-鿿]/;

/**
 * 「卵」「鮭」のような1文字の語は、前後に漢字が続くと別の言葉の一部である可能性が高い。
 * 「醤油」の「油」を油と読み違えないための判定。
 */
function isStandaloneSingleCharacter(text: string, index: number): boolean {
  const before = index > 0 ? text[index - 1] : '';
  const after = index + 1 < text.length ? text[index + 1] : '';
  return !KANJI.test(before) && !KANJI.test(after);
}

/**
 * 「朝食は〜、昼は〜」のように、どの食事かを示す語。
 * ここで区切って、それぞれを朝・昼・晩・間食に振り分ける。
 * 同時に「朝ごはん」の「ごはん」を食品として拾ってしまうのも防ぐ。
 */
type SlotMarker = { phrase: string; slot: MealSlot };

const SLOT_MARKER_LIST: SlotMarker[] = [
  { phrase: '朝ごはん', slot: 'breakfast' },
  { phrase: '朝ご飯', slot: 'breakfast' },
  { phrase: '朝食', slot: 'breakfast' },
  { phrase: '朝めし', slot: 'breakfast' },
  { phrase: '朝', slot: 'breakfast' },
  { phrase: '昼ごはん', slot: 'lunch' },
  { phrase: '昼ご飯', slot: 'lunch' },
  { phrase: '昼食', slot: 'lunch' },
  { phrase: 'お昼', slot: 'lunch' },
  { phrase: 'らんち', slot: 'lunch' },
  { phrase: '昼', slot: 'lunch' },
  { phrase: '晩ごはん', slot: 'dinner' },
  { phrase: '晩ご飯', slot: 'dinner' },
  { phrase: '晩御飯', slot: 'dinner' },
  { phrase: '夕ごはん', slot: 'dinner' },
  { phrase: '夕ご飯', slot: 'dinner' },
  { phrase: '夜ごはん', slot: 'dinner' },
  { phrase: '夜ご飯', slot: 'dinner' },
  { phrase: '夕食', slot: 'dinner' },
  { phrase: '夕飯', slot: 'dinner' },
  { phrase: 'でぃなー', slot: 'dinner' },
  { phrase: '晩', slot: 'dinner' },
  { phrase: '夜食', slot: 'snack' },
  { phrase: '間食', slot: 'snack' },
  { phrase: 'おやつ', slot: 'snack' },
  { phrase: '夜', slot: 'dinner' },
];

/** 長い目印から先に照合する。「朝食」より短い「朝」が先に当たらないようにするため。 */
const SLOT_MARKERS: SlotMarker[] = [...SLOT_MARKER_LIST].sort(
  (left, right) => right.phrase.length - left.phrase.length,
);

/** 食品名を含むが食品ではない語。器の名前など。 */
const NON_FOOD_PHRASES = ['ご飯茶碗', 'お茶碗'].sort(
  (left, right) => right.length - left.length,
);

/**
 * 食品ではない語を、同じ長さの制御文字で塗りつぶす。
 * 長さを変えないのは、分量の位置関係を崩さないため。
 */
function maskNonFoodPhrases(text: string): string {
  let masked = text;
  for (const phrase of NON_FOOD_PHRASES) {
    let index = masked.indexOf(phrase);
    while (index !== -1) {
      masked = masked.slice(0, index) + '\u0000'.repeat(phrase.length) + masked.slice(index + phrase.length);
      index = masked.indexOf(phrase, index + phrase.length);
    }
  }
  return masked;
}

type FoodMatch = { food: Food; start: number; end: number };

/**
 * 「サーモンのお刺身」のように、素材名＋「の」＋料理名 が並ぶときは料理だけを残す。
 * 素材と料理を二重に数えないため。
 */
function dropIngredientsBeforeDish(matches: FoodMatch[], normalized: string): FoodMatch[] {
  const dropped = new Set<number>();
  for (let index = 0; index < matches.length - 1; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const between = normalized.slice(current.end, next.start);
    if (next.food.category === '料理' && /^の[お]?$/.test(between)) {
      dropped.add(index);
    }
  }
  return matches.filter((_, index) => !dropped.has(index));
}

/** 文節に含まれる食品を、重ならないように長いものから拾い、出現順に並べる。 */
function findFoodMatches(normalized: string): FoodMatch[] {
  const consumed = new Array<boolean>(normalized.length).fill(false);
  const matches: FoodMatch[] = [];

  for (const { token, food } of FOOD_TOKENS) {
    if (matches.some((match) => match.food === food)) continue;
    let searchFrom = 0;
    while (searchFrom <= normalized.length - token.length) {
      const index = normalized.indexOf(token, searchFrom);
      if (index === -1) break;
      const overlaps = consumed.slice(index, index + token.length).some(Boolean);
      const isUsable = token.length > 1 || isStandaloneSingleCharacter(normalized, index);
      if (!overlaps && isUsable) {
        for (let position = index; position < index + token.length; position += 1) consumed[position] = true;
        matches.push({ food, start: index, end: index + token.length });
        break;
      }
      searchFrom = index + 1;
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

/** 分量の手がかりと食品定義から、実際のグラム数を決める。 */
function resolveGrams(food: Food, amount: SegmentAmount): number {
  if (amount.explicitGrams !== null) return amount.explicitGrams;

  const serving = parseServingLabel(food.servingLabel);
  if (amount.count === null) return Math.round(food.servingGrams * amount.modifier);

  // 数え方が1食分の呼び方と同じなら1個あたりに割り戻し、違うなら「N人前」とみなす
  const servingUnit = serving.unit === null ? null : normalizeText(serving.unit);
  const gramsPerUnit =
    amount.unit !== null && servingUnit !== null && amount.unit === servingUnit && serving.count > 0
      ? food.servingGrams / serving.count
      : food.servingGrams;
  return Math.max(1, Math.round(gramsPerUnit * amount.count * amount.modifier));
}

export type ParsedMealGroup = {
  /** 文中で指定されていた食事の区分。指定がなければ null */
  slot: MealSlot | null;
  items: MealItem[];
};

export type ParsedMeal = {
  groups: ParsedMealGroup[];
  /** 食品を1つも見つけられなかった文節。手で足してもらうために返す */
  unmatchedSegments: string[];
};

type SlotChunk = { slot: MealSlot | null; text: string };

/**
 * 「朝食は〜、昼は〜」のような文を、食事の区分ごとに切り分ける。
 * 目印が無ければ、全体を区分なしの1つとして返す。
 */
function splitBySlot(rawText: string): SlotChunk[] {
  const normalized = normalizeText(rawText);
  type Hit = { index: number; length: number; slot: MealSlot };
  const hits: Hit[] = [];

  for (const marker of SLOT_MARKERS) {
    const phrase = normalizeText(marker.phrase);
    let from = 0;
    while (from <= normalized.length - phrase.length) {
      const index = normalized.indexOf(phrase, from);
      if (index === -1) break;
      // すでに見つけた長い目印と重なる場合は数えない
      const overlaps = hits.some(
        (hit) => index < hit.index + hit.length && hit.index < index + phrase.length,
      );
      if (!overlaps) hits.push({ index, length: phrase.length, slot: marker.slot });
      from = index + 1;
    }
  }

  if (hits.length === 0) return [{ slot: null, text: normalized }];

  hits.sort((left, right) => left.index - right.index);
  const chunks: SlotChunk[] = [];

  // 最初の目印より前の部分は、区分が指定されていない扱いにする
  const head = normalized.slice(0, hits[0].index).trim();
  if (head.length > 0) chunks.push({ slot: null, text: head });

  hits.forEach((hit, order) => {
    const start = hit.index + hit.length;
    const end = order + 1 < hits.length ? hits[order + 1].index : normalized.length;
    // 目印の直後の「は」「に」「には」は本文ではないので落とす
    const text = normalized.slice(start, end).replace(/^(には|は|に|も|わ)/, '').trim();
    if (text.length > 0) chunks.push({ slot: hit.slot, text });
  });

  return chunks.length > 0 ? chunks : [{ slot: null, text: normalized }];
}

/** 1つの区分ぶんの文字列を、食品と分量に分解する。 */
function parseChunk(chunkText: string): { items: MealItem[]; unmatched: string[] } {
  const segments = chunkText
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const items: MealItem[] = [];
  const unmatchedSegments: string[] = [];

  for (const segment of segments) {
    const normalized = maskNonFoodPhrases(segment.replace(TRAILING_VERBS, ''));
    const matches = dropIngredientsBeforeDish(findFoodMatches(normalized), normalized);
    if (matches.length === 0) {
      unmatchedSegments.push(segment);
      continue;
    }

    matches.forEach((match, index) => {
      // 日本語では分量が食品名のあとに来るので、次の食品名までの範囲だけを見る
      const scopeEnd = index + 1 < matches.length ? matches[index + 1].start : normalized.length;
      const scope = normalized.slice(match.end, scopeEnd);
      const amount = extractAmount(scope, matches.length === 1 ? normalized : scope);
      const grams = resolveGrams(match.food, amount);
      items.push({
        foodId: match.food.id,
        name: match.food.name,
        grams,
        matchedText: segment,
        nutrients: scaleNutrients(match.food.per100g, grams),
      });
    });
  }

  return { items, unmatched: unmatchedSegments };
}

/**
 * 音声入力された文を、食事の区分ごとに食品と分量へ分解する。
 * 「朝食はパンと卵、昼はラーメン」のように1度に複数の食事を入れられる。
 */
export function parseSpokenMeal(rawText: string): ParsedMeal {
  const groups: ParsedMealGroup[] = [];
  const unmatchedSegments: string[] = [];

  for (const chunk of splitBySlot(rawText)) {
    const parsed = parseChunk(chunk.text);
    unmatchedSegments.push(...parsed.unmatched);
    if (parsed.items.length > 0) groups.push({ slot: chunk.slot, items: parsed.items });
  }

  return { groups, unmatchedSegments };
}

/** 区分を問わず、拾えた食品をすべて平らに並べる。 */
export function flattenParsedMeal(parsed: ParsedMeal): MealItem[] {
  return parsed.groups.flatMap((group) => group.items);
}

/** 手入力や分量の修正から食事の項目を作り直す。 */
export function createMealItem(food: Food, grams: number, matchedText = ''): MealItem {
  return {
    foodId: food.id,
    name: food.name,
    grams,
    matchedText,
    nutrients: scaleNutrients(food.per100g, grams),
  };
}

/** 名前の一部から食品を検索する（手入力の候補表示用）。 */
export function searchFoods(query: string, limit = 12): Food[] {
  const normalized = normalizeText(query);
  if (normalized.length === 0) return [];
  const matches: Food[] = [];
  for (const { token, food } of FOOD_TOKENS) {
    if (matches.includes(food)) continue;
    if (token.includes(normalized)) matches.push(food);
    if (matches.length >= limit) break;
  }
  return matches;
}
