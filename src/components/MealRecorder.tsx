import { useMemo, useState } from 'react';
import { FOODS_BY_ID } from '../data/foods';
import { scaleNutrients } from '../data/nutrients';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { todayKey } from '../lib/dates';
import { createId } from '../lib/repository';
import { MEAL_SLOT_LABELS, type MealItem, type MealLog, type MealSlot, type Profile } from '../lib/types';
import { createMealItem, parseSpokenMeal, searchFoods } from '../logic/parseSpokenMeal';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function guessSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

type Props = {
  profile: Profile;
  onSave: (log: MealLog) => Promise<void>;
};

export function MealRecorder({ profile, onSave }: Props) {
  const speech = useSpeechRecognition();
  const [manualText, setManualText] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [slot, setSlot] = useState<MealSlot>(guessSlot);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // 打ち直しの途中で「0」に化けないよう、入力中の文字列はそのまま持っておく
  const [gramsDrafts, setGramsDrafts] = useState<Record<number, string>>({});

  const spokenText = `${speech.transcript}${speech.interimTranscript}`;
  const editorText = manualText || spokenText;

  const searchResults = useMemo(() => searchFoods(searchQuery), [searchQuery]);

  const savableItems = items.filter((item) => item.grams > 0);
  const totalEnergy = savableItems.reduce((total, item) => total + item.nutrients.energy, 0);

  function handleParse() {
    const parsed = parseSpokenMeal(editorText);
    setGramsDrafts({});
    setItems((current) => [...current, ...parsed.items]);
    setUnmatched(parsed.unmatchedSegments);
    setManualText('');
    speech.reset();
  }

  function handleGramsChange(index: number, rawValue: string) {
    setGramsDrafts((current) => ({ ...current, [index]: rawValue }));
    // 空欄や不正な値で NaN が栄養素に混ざらないようにする
    const parsed = Number(rawValue);
    const grams = rawValue.trim() === '' || !Number.isFinite(parsed) ? 0 : Math.max(0, Math.min(2000, parsed));
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const food = FOODS_BY_ID.get(item.foodId);
        if (!food) return item;
        return { ...item, grams, nutrients: scaleNutrients(food.per100g, grams) };
      }),
    );
  }

  /** 入力欄から離れたら、実際に採用された値に表示をそろえる。 */
  function handleGramsBlur(index: number) {
    setGramsDrafts((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  function handleRemoveItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setGramsDrafts({});
  }

  async function handleSave() {
    // 分量が 0 の項目は記録に混ぜない
    const savableItems = items.filter((item) => item.grams > 0);
    if (savableItems.length === 0) return;
    setIsSaving(true);
    try {
      await onSave({
        id: createId(),
        profileId: profile.id,
        date: todayKey(),
        slot,
        rawText: editorText,
        items: savableItems,
        createdAt: new Date().toISOString(),
      });
      setItems([]);
      setUnmatched([]);
      setGramsDrafts({});
      setManualText('');
      speech.reset();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">食べたものを記録する</h2>

      <div className="slot-picker">
        {SLOTS.map((value) => (
          <button
            key={value}
            type="button"
            className={value === slot ? 'chip is-active' : 'chip'}
            onClick={() => setSlot(value)}
          >
            {MEAL_SLOT_LABELS[value]}
          </button>
        ))}
      </div>

      {speech.isSupported && (
        <button
          type="button"
          className={speech.isListening ? 'mic-button is-listening' : 'mic-button'}
          onClick={speech.isListening ? speech.stop : speech.start}
        >
          {speech.isListening ? '● 聞いています（押すと停止）' : '🎤 話して入力する'}
        </button>
      )}

      {speech.error && <p className="alert">{speech.error}</p>}

      <textarea
        className="text-input"
        rows={3}
        value={editorText}
        placeholder="例：ごはん一膳と鮭の塩焼き、味噌汁、ほうれん草のおひたし"
        onChange={(event) => setManualText(event.target.value)}
      />

      <p className="note">
        {speech.isSupported
          ? 'この欄をタップして、キーボードのマイクキーから話しても入力できます。iPhoneではそちらのほうが確実で、認識精度も高めです。'
          : 'この欄をタップして、キーボードのマイクキーから話すと音声で入力できます。'}
      </p>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={handleParse} disabled={!editorText.trim()}>
          栄養に変換する
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setManualText('');
            speech.reset();
          }}
        >
          入力を消す
        </button>
      </div>

      {unmatched.length > 0 && (
        <p className="note">
          わからなかった言葉：{unmatched.join(' / ')}
          <br />
          下の検索から手で足してください。
        </p>
      )}

      {items.length > 0 && (
        <ul className="item-list">
          {items.map((item, index) => (
            <li className="item-row" key={`${item.foodId}-${index}`}>
              <span className="item-name">{item.name}</span>
              <label className="item-grams">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2000}
                  value={gramsDrafts[index] ?? String(item.grams)}
                  onChange={(event) => handleGramsChange(index, event.target.value)}
                  onBlur={() => handleGramsBlur(index)}
                />
                g
              </label>
              <span className="item-energy">{Math.round(item.nutrients.energy)}kcal</span>
              <button type="button" className="icon-button" onClick={() => handleRemoveItem(index)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="search-block">
        <input
          className="text-input"
          type="search"
          value={searchQuery}
          placeholder="食品を名前で探して足す"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => {
                    setItems((current) => [...current, createMealItem(food, food.servingGrams)]);
                    setSearchQuery('');
                  }}
                >
                  {food.name}
                  <span className="search-serving">
                    {food.servingLabel}＝{food.servingGrams}g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={savableItems.length === 0 || isSaving}
        >
          {isSaving ? '保存中…' : `この${MEAL_SLOT_LABELS[slot]}を記録（${Math.round(totalEnergy)}kcal）`}
        </button>
      </div>
    </section>
  );
}
