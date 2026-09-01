import { useMemo, useState } from 'react';
import { FOODS_BY_ID } from '../data/foods';
import { scaleNutrients } from '../data/nutrients';
import { todayKey } from '../lib/dates';
import { createId } from '../lib/repository';
import { MEAL_SLOT_LABELS, type MealItem, type MealLog, type MealSlot, type Profile } from '../lib/types';
import { createMealItem, parseSpokenMeal, searchFoods } from '../logic/parseSpokenMeal';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** 文中で食事の区分が指定されていなかったときに、時刻から推測する。 */
function guessSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/** 画面上で編集できる、1つの食事のまとまり。 */
type EditableGroup = {
  id: string;
  slot: MealSlot;
  items: MealItem[];
  /** 文中で区分が指定されていたかどうか。指定されていれば見出しに印を出す */
  slotWasSpoken: boolean;
};

type Props = {
  profile: Profile;
  onSave: (log: MealLog) => Promise<void>;
};

export function MealRecorder({ profile, onSave }: Props) {
  const [text, setText] = useState('');
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTargetId, setSearchTargetId] = useState<string | null>(null);
  const [gramsDrafts, setGramsDrafts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const searchResults = useMemo(() => searchFoods(searchQuery), [searchQuery]);

  const savableGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.grams > 0) }))
    .filter((group) => group.items.length > 0);
  const totalEnergy = savableGroups.reduce(
    (total, group) => total + group.items.reduce((sum, item) => sum + item.nutrients.energy, 0),
    0,
  );

  function handleParse() {
    const parsed = parseSpokenMeal(text);
    const fallback = guessSlot();
    setGroups((current) => [
      ...current,
      ...parsed.groups.map((group) => ({
        id: createId(),
        slot: group.slot ?? fallback,
        items: group.items,
        slotWasSpoken: group.slot !== null,
      })),
    ]);
    setUnmatched(parsed.unmatchedSegments);
    setGramsDrafts({});
    setText('');
  }

  function updateGroup(groupId: string, change: (group: EditableGroup) => EditableGroup) {
    setGroups((current) => current.map((group) => (group.id === groupId ? change(group) : group)));
  }

  function handleGramsChange(groupId: string, index: number, rawValue: string) {
    const key = `${groupId}:${index}`;
    setGramsDrafts((current) => ({ ...current, [key]: rawValue }));
    const parsed = Number(rawValue);
    const grams =
      rawValue.trim() === '' || !Number.isFinite(parsed) ? 0 : Math.max(0, Math.min(2000, parsed));
    updateGroup(groupId, (group) => ({
      ...group,
      items: group.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const food = FOODS_BY_ID.get(item.foodId);
        if (!food) return item;
        return { ...item, grams, nutrients: scaleNutrients(food.per100g, grams) };
      }),
    }));
  }

  function handleGramsBlur(groupId: string, index: number) {
    setGramsDrafts((current) => {
      const next = { ...current };
      delete next[`${groupId}:${index}`];
      return next;
    });
  }

  async function handleSave() {
    if (savableGroups.length === 0) return;
    setIsSaving(true);
    try {
      for (const group of savableGroups) {
        await onSave({
          id: createId(),
          profileId: profile.id,
          date: todayKey(),
          slot: group.slot,
          rawText: '',
          items: group.items,
          createdAt: new Date().toISOString(),
        });
      }
      setGroups([]);
      setUnmatched([]);
      setGramsDrafts({});
      setText('');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">食べたものを記録する</h2>

      <p className="note">
        下の欄をタップして、キーボードの<strong>マイクキー</strong>を押すと話して入力できます。
        「朝食は〜、昼は〜」のようにまとめて言えば、朝・昼・晩・間食に自動で振り分けます。
      </p>

      <textarea
        className="text-input"
        rows={4}
        value={text}
        placeholder="例：朝食はパン2枚と卵、昼はラーメン、夜はごはん一膳と鮭の塩焼きと味噌汁"
        onChange={(event) => setText(event.target.value)}
      />

      <div className="button-row">
        <button type="button" className="primary-button" onClick={handleParse} disabled={!text.trim()}>
          栄養に変換する
        </button>
        <button type="button" className="ghost-button" onClick={() => setText('')}>
          入力を消す
        </button>
      </div>

      {unmatched.length > 0 && (
        <p className="note">
          わからなかった言葉：{unmatched.join(' / ')}
          <br />
          下の「食品を足す」から手で加えてください。
        </p>
      )}

      {groups.map((group) => (
        <div className="meal-group" key={group.id}>
          <div className="meal-group-head">
            <div className="chip-row">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={group.slot === slot ? 'chip is-active' : 'chip'}
                  onClick={() => updateGroup(group.id, (current) => ({ ...current, slot }))}
                >
                  {MEAL_SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setGroups((current) => current.filter((entry) => entry.id !== group.id))}
              aria-label="このまとまりを消す"
            >
              ×
            </button>
          </div>

          {!group.slotWasSpoken && (
            <p className="note">
              どの食事か言われていなかったので、時刻から「{MEAL_SLOT_LABELS[group.slot]}」にしました。
            </p>
          )}

          <ul className="item-list">
            {group.items.map((item, index) => (
              <li className="item-row" key={`${item.foodId}-${index}`}>
                <span className="item-name">{item.name}</span>
                <label className="item-grams">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={2000}
                    value={gramsDrafts[`${group.id}:${index}`] ?? String(item.grams)}
                    onChange={(event) => handleGramsChange(group.id, index, event.target.value)}
                    onBlur={() => handleGramsBlur(group.id, index)}
                  />
                  g
                </label>
                <span className="item-energy">{Math.round(item.nutrients.energy)}kcal</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    updateGroup(group.id, (current) => ({
                      ...current,
                      items: current.items.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  aria-label="この食品を消す"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="ghost-button"
            onClick={() => setSearchTargetId(searchTargetId === group.id ? null : group.id)}
          >
            {searchTargetId === group.id ? '食品を足すのをやめる' : '食品を足す'}
          </button>

          {searchTargetId === group.id && (
            <div className="search-block">
              <input
                className="text-input"
                type="search"
                value={searchQuery}
                placeholder="食品を名前で探す"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchResults.length > 0 && (
                <ul className="search-results">
                  {searchResults.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => {
                          updateGroup(group.id, (current) => ({
                            ...current,
                            items: [...current.items, createMealItem(food, food.servingGrams)],
                          }));
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
          )}
        </div>
      ))}

      {savableGroups.length > 0 && (
        <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
          {isSaving
            ? '保存中…'
            : `${savableGroups.length}件の食事を記録（合計${Math.round(totalEnergy)}kcal）`}
        </button>
      )}
    </section>
  );
}
