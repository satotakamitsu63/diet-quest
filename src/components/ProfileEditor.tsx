import { useState } from 'react';
import type { ActivityLevel } from '../data/dietaryReference';
import { createId } from '../lib/repository';
import { SPECIES_KEYS, SPECIES_LABELS, type Award, type GoalPreset, type Profile } from '../lib/types';
import {
  AWARD_CATEGORY_LABELS,
  AWARD_SCALE_LABELS,
  AWARD_SCALE_POINTS,
  CLUBS,
  CLUB_KEYS,
  type AwardCategory,
  type AwardScale,
  type ClubKey,
} from '../data/clubs';
import { PREDICTED_HEIGHT_RANGE_CM, predictAdultHeight } from '../logic/heightGoal';
import {
  GOAL_PRESETS,
  MAXIMUM_TARGET_BODY_FAT,
  MINIMUM_TARGET_BODY_FAT,
  checkTargetWeight,
  isChild,
  maximumTargetWeightKg,
  minimumTargetWeightKg,
  resolveAge,
} from '../logic/bodyGoal';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  1: 'ほとんど座っている',
  2: 'ふつうに動く・通勤や家事',
  3: '運動習慣がある・立ち仕事',
};

/** 目標BMIを、その身長での体重(kg)に直す。プリセットを実感できる数字で見せるため。 */
function weightForBmi(bmi: number, heightCm: number): number {
  const meters = heightCm / 100;
  return Math.round(bmi * meters * meters * 10) / 10;
}

export function createBlankProfile(groupId: string): Profile {
  return {
    id: createId(),
    groupId,
    ownerId: null,
    displayName: '',
    birthDate: null,
    ageYears: null,
    sex: 'female',
    heightCm: null,
    activityLevel: 2,
    isMenstruating: false,
    goalPreset: 'ideal',
    customTargetWeightKg: null,
    customTargetBmi: null,
    customTargetBodyFatPercent: null,
    aestheticSportMode: false,
    growthBoost: true,
    fatherHeightCm: null,
    motherHeightCm: null,
    targetAdultHeightCm: null,
    species: 'cat',
    characterName: '',
    club: 'none',
    customSpecialMoveName: null,
    awards: [],
    createdAt: new Date().toISOString(),
  };
}

type Props = {
  profile: Profile;
  onSave: (profile: Profile) => Promise<void>;
  onCancel?: () => void;
  onDelete?: (profileId: string) => Promise<void>;
};

export function ProfileEditor({ profile, onSave, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [awardTitle, setAwardTitle] = useState('');
  const [awardCategory, setAwardCategory] = useState<AwardCategory>('sports');
  const [awardScale, setAwardScale] = useState<AwardScale>('school');
  const [awardYear, setAwardYear] = useState('');

  const age = resolveAge(draft);
  const childMode = isChild(age);
  const predictedHeight = predictAdultHeight(draft.sex, draft.fatherHeightCm, draft.motherHeightCm);

  const targetWeightWarning =
    draft.goalPreset === 'custom' && draft.customTargetWeightKg !== null && draft.heightCm
      ? checkTargetWeight(draft.customTargetWeightKg, draft.heightCm).reason
      : null;

  const bodyFatFloor = MINIMUM_TARGET_BODY_FAT[draft.sex];
  const bodyFatWarning =
    draft.goalPreset === 'custom' &&
    draft.customTargetBodyFatPercent !== null &&
    draft.customTargetBodyFatPercent < bodyFatFloor
      ? `体脂肪率 ${bodyFatFloor}% が下限です。これを下回ると必須脂肪を割り込み、${
          draft.sex === 'female' ? '無月経と骨密度低下' : 'テストステロン低下と骨密度低下'
        }を招くため、${bodyFatFloor}% として扱います。`
      : null;

  function update<Key extends keyof Profile>(key: Key, value: Profile[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!draft.displayName.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        displayName: draft.displayName.trim(),
        characterName: draft.characterName.trim() || `${draft.displayName.trim()}のあいぼう`,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">{profile.displayName ? `${profile.displayName} の設定` : 'メンバーを追加'}</h2>

      <label className="field">
        <span>名前</span>
        <input
          type="text"
          value={draft.displayName}
          onChange={(event) => update('displayName', event.target.value)}
          placeholder="例：はなこ"
        />
      </label>

      <label className="field">
        <span>キャラクターの名前</span>
        <input
          type="text"
          value={draft.characterName}
          onChange={(event) => update('characterName', event.target.value)}
          placeholder="例：みけ"
        />
      </label>

      <div className="field">
        <span>キャラクターの種類</span>
        <div className="chip-row">
          {SPECIES_KEYS.map((species) => (
            <button
              key={species}
              type="button"
              className={draft.species === species ? 'chip is-active' : 'chip'}
              onClick={() => update('species', species)}
            >
              {SPECIES_LABELS[species]}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>生年月日</span>
          <input
            type="date"
            value={draft.birthDate ?? ''}
            onChange={(event) => update('birthDate', event.target.value || null)}
          />
        </label>
        <label className="field">
          <span>または年齢</span>
          <input
            type="number"
            min={1}
            max={120}
            value={draft.ageYears ?? ''}
            onChange={(event) =>
              update('ageYears', event.target.value === '' ? null : Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="field">
        <span>性別（食事摂取基準の参照に使う）</span>
        <div className="chip-row">
          {(['female', 'male'] as const).map((sex) => (
            <button
              key={sex}
              type="button"
              className={draft.sex === sex ? 'chip is-active' : 'chip'}
              onClick={() => update('sex', sex)}
            >
              {sex === 'female' ? '女性' : '男性'}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>身長 (cm)　※分からなければ空欄でよい</span>
        <input
          type="number"
          inputMode="decimal"
          value={draft.heightCm ?? ''}
          onChange={(event) =>
            update('heightCm', event.target.value === '' ? null : Number(event.target.value))
          }
        />
      </label>

      <div className="field">
        <span>ふだんの活動量</span>
        <div className="chip-row">
          {([1, 2, 3] as ActivityLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={draft.activityLevel === level ? 'chip is-active' : 'chip'}
              onClick={() => update('activityLevel', level)}
            >
              {ACTIVITY_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {draft.sex === 'female' && age !== null && age >= 10 && (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.isMenstruating}
            onChange={(event) => update('isMenstruating', event.target.checked)}
          />
          <span>月経がある（鉄の必要量が上がります）</span>
        </label>
      )}

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={draft.aestheticSportMode}
          onChange={(event) => update('aestheticSportMode', event.target.checked)}
        />
        <span>
          バレエ・新体操・陸上などをしている
          <small>
            エネルギー必要量を高い側で見積もり、鉄・カルシウム・ビタミンD・たんぱく質を重点的に確認します。
          </small>
        </span>
      </label>

      <div className="field">
        <span>やっているスポーツ・部活・習い事</span>
        <select value={draft.club} onChange={(event) => update('club', event.target.value as ClubKey)}>
          {CLUB_KEYS.map((key) => (
            <option key={key} value={key}>
              {CLUBS[key].label}
            </option>
          ))}
        </select>
      </div>

      <label className="field">
        <span>必殺技の名前　※空欄なら「{CLUBS[draft.club].specialMoveName}」</span>
        <input
          type="text"
          value={draft.customSpecialMoveName ?? ''}
          placeholder={CLUBS[draft.club].specialMoveName}
          onChange={(event) => update('customSpecialMoveName', event.target.value || null)}
        />
      </label>

      <div className="field">
        <span>
          受賞歴（スポーツ点・勉強点になります・合計{20}点まで）
        </span>
        {draft.awards.length > 0 && (
          <ul className="award-list">
            {draft.awards.map((award) => (
              <li key={award.id}>
                <span className="award-title">{award.title}</span>
                <span className="award-meta">
                  {AWARD_CATEGORY_LABELS[award.category]}・{AWARD_SCALE_LABELS[award.scale]}
                  {award.year !== null && `・${award.year}年`}
                  <strong>＋{AWARD_SCALE_POINTS[award.scale]}点</strong>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    update('awards', draft.awards.filter((entry) => entry.id !== award.id))
                  }
                  aria-label="この受賞歴を消す"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="award-form">
          <input
            type="text"
            className="text-input"
            value={awardTitle}
            placeholder="例：市の水泳大会 50m自由形 2位"
            onChange={(event) => setAwardTitle(event.target.value)}
          />
          <div className="field-row">
            <select
              value={awardCategory}
              onChange={(event) => setAwardCategory(event.target.value as AwardCategory)}
            >
              {(Object.keys(AWARD_CATEGORY_LABELS) as AwardCategory[]).map((key) => (
                <option key={key} value={key}>
                  {AWARD_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
            <select
              value={awardScale}
              onChange={(event) => setAwardScale(event.target.value as AwardScale)}
            >
              {(Object.keys(AWARD_SCALE_LABELS) as AwardScale[]).map((key) => (
                <option key={key} value={key}>
                  {AWARD_SCALE_LABELS[key]}（＋{AWARD_SCALE_POINTS[key]}点）
                </option>
              ))}
            </select>
            <input
              type="number"
              value={awardYear}
              placeholder="年"
              onChange={(event) => setAwardYear(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={!awardTitle.trim()}
            onClick={() => {
              const award: Award = {
                id: createId(),
                title: awardTitle.trim(),
                category: awardCategory,
                scale: awardScale,
                year: awardYear === '' ? null : Number(awardYear),
              };
              update('awards', [...draft.awards, award]);
              setAwardTitle('');
              setAwardYear('');
            }}
          >
            受賞歴を足す
          </button>
        </div>
      </div>

      {childMode ? (
        <>
          <p className="note">
            18歳未満なので、体重を減らす目標は設定しません。身長の伸びと栄養の充足でキャラクターが育ちます。
          </p>

          <div className="field-row">
            <label className="field">
              <span>父の身長 (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.fatherHeightCm ?? ''}
                onChange={(event) =>
                  update('fatherHeightCm', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>母の身長 (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft.motherHeightCm ?? ''}
                onChange={(event) =>
                  update('motherHeightCm', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
          </div>

          {predictedHeight !== null && (
            <p className="note">
              両親の身長からの予測成人身長は <strong>{predictedHeight}cm</strong>（おおよそ{' '}
              {predictedHeight - PREDICTED_HEIGHT_RANGE_CM}〜{predictedHeight + PREDICTED_HEIGHT_RANGE_CM}cm
              の幅）です。目標身長を空欄にすると、この予測値を目標として使います。
            </p>
          )}

          <label className="field">
            <span>目標身長 (cm)　※空欄なら上の予測値を使う</span>
            <input
              type="number"
              inputMode="decimal"
              value={draft.targetAdultHeightCm ?? ''}
              placeholder={predictedHeight !== null ? String(predictedHeight) : ''}
              onChange={(event) =>
                update(
                  'targetAdultHeightCm',
                  event.target.value === '' ? null : Number(event.target.value),
                )
              }
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={draft.growthBoost}
              onChange={(event) => update('growthBoost', event.target.checked)}
            />
            <span>
              成長期ブーストを使う
              <small>
                たんぱく質・カルシウム・ビタミンDの目標を推奨量より約2割厚くします（カルシウムは1日1000mg、
                たんぱく質は体重1kgあたり2.0gを上限)。狙いは背を伸ばすことではなく、伸びしろを取りこぼさないことです。
                推奨量を超えた分が到達身長を押し上げるという根拠はありません。
              </small>
            </span>
          </label>
        </>
      ) : (
        <>
          <div className="field">
            <span>目標とする体型</span>
            <div className="preset-list">
              {(Object.keys(GOAL_PRESETS) as Array<keyof typeof GOAL_PRESETS>).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={draft.goalPreset === key ? 'preset-card is-active' : 'preset-card'}
                  onClick={() => update('goalPreset', key as GoalPreset)}
                >
                  <strong>{GOAL_PRESETS[key].label}</strong>
                  <span>
                    {draft.heightCm
                      ? `目標体重 ${weightForBmi(GOAL_PRESETS[key].targetBmi[draft.sex], draft.heightCm)}kg`
                      : `BMI ${GOAL_PRESETS[key].targetBmi[draft.sex]}`}
                    {' ／ 体脂肪率 '}
                    {GOAL_PRESETS[key].targetBodyFatPercent[draft.sex]}%
                  </span>
                  <small>{GOAL_PRESETS[key].description}</small>
                </button>
              ))}
              <button
                type="button"
                className={draft.goalPreset === 'custom' ? 'preset-card is-active' : 'preset-card'}
                onClick={() => update('goalPreset', 'custom')}
              >
                <strong>自分で決める</strong>
                <span>目標の体重と体脂肪率を自分で入れる</span>
                <small>
                  {draft.heightCm
                    ? `身長 ${draft.heightCm}cm なら ${minimumTargetWeightKg(draft.heightCm)}〜${maximumTargetWeightKg(draft.heightCm)}kg の範囲で設定できます。`
                    : '身長を入れると、設定できる体重の範囲が出ます。'}
                  {' 体脂肪率は男性 '}
                  {MINIMUM_TARGET_BODY_FAT.male}% ・女性 {MINIMUM_TARGET_BODY_FAT.female}% 未満には
                  設定できません。
                </small>
              </button>
            </div>
          </div>

          {draft.goalPreset === 'custom' && (
            <>
              <div className="field-row">
                <label className="field">
                  <span>目標体重 (kg)</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.customTargetWeightKg ?? ''}
                    placeholder={draft.heightCm ? `${minimumTargetWeightKg(draft.heightCm)} 以上` : ''}
                    onChange={(event) =>
                      update(
                        'customTargetWeightKg',
                        event.target.value === '' ? null : Number(event.target.value),
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>目標体脂肪率 (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    min={MINIMUM_TARGET_BODY_FAT[draft.sex]}
                    max={MAXIMUM_TARGET_BODY_FAT[draft.sex]}
                    value={draft.customTargetBodyFatPercent ?? ''}
                    onChange={(event) =>
                      update(
                        'customTargetBodyFatPercent',
                        event.target.value === '' ? null : Number(event.target.value),
                      )
                    }
                  />
                </label>
              </div>
              {!draft.heightCm && (
                <p className="note">
                  身長が未入力です。目標体重を体型の判定に使うには身長が要るので、上の欄に入れてください。
                </p>
              )}
              {targetWeightWarning && <p className="alert">{targetWeightWarning}</p>}
              {bodyFatWarning && <p className="alert">{bodyFatWarning}</p>}
            </>
          )}
        </>
      )}

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={isSaving || !draft.displayName.trim()}
        >
          {isSaving ? '保存中…' : '保存する'}
        </button>
        {onCancel && (
          <button type="button" className="ghost-button" onClick={onCancel}>
            やめる
          </button>
        )}
        {onDelete && profile.displayName && (
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              const confirmed = window.confirm(
                `${profile.displayName} さんと、その食事・体の記録をすべて消します。よろしいですか？`,
              );
              if (confirmed) void onDelete(profile.id);
            }}
          >
            このメンバーを削除
          </button>
        )}
      </div>
    </section>
  );
}
