import { useState } from 'react';
import { CHILD_STANDARD_SOURCE } from '../data/childStandardWeight';
import { todayKey } from '../lib/dates';
import { createId } from '../lib/repository';
import type { BodyLog, Profile } from '../lib/types';
import type { BodyAssessment } from '../logic/bodyGoal';
import { referenceVelocityRange, type HeightGoal, type HeightVelocity } from '../logic/heightGoal';

type Props = {
  profile: Profile;
  age: number | null;
  assessment: BodyAssessment;
  latestLog: BodyLog | null;
  heightGoal: HeightGoal | null;
  heightVelocity: HeightVelocity | null;
  isGrowthBoosted: boolean;
  onSave: (log: BodyLog) => Promise<void>;
};

/** いまの値と目標の差を、増やす／減らすが分かる言い方にする。 */
function describeGap(current: number, target: number, unit: string): string {
  const difference = Math.round((current - target) * 10) / 10;
  if (Math.abs(difference) < 0.5) return `目標に到達しています（${target}${unit}）`;
  if (difference > 0) return `目標まであと −${Math.abs(difference)}${unit}`;
  return `目標まであと +${Math.abs(difference)}${unit}`;
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function BodyLogCard({
  profile,
  age,
  assessment,
  latestLog,
  heightGoal,
  heightVelocity,
  isGrowthBoosted,
  onSave,
}: Props) {
  const [weight, setWeight] = useState(latestLog?.weightKg?.toString() ?? '');
  const [height, setHeight] = useState(
    (latestLog?.heightCm ?? profile.heightCm)?.toString() ?? '',
  );
  const [bodyFat, setBodyFat] = useState(latestLog?.bodyFatPercent?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const velocityReference = age !== null ? referenceVelocityRange(age, profile.sex) : null;

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        id: latestLog?.date === todayKey() ? latestLog.id : createId(),
        profileId: profile.id,
        date: todayKey(),
        weightKg: parseOptionalNumber(weight),
        heightCm: parseOptionalNumber(height),
        bodyFatPercent: parseOptionalNumber(bodyFat),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">からだの記録</h2>

      <div className="field-row">
        <label className="field">
          <span>身長 (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            placeholder="未入力でも可"
          />
        </label>
        <label className="field">
          <span>体重 (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="未入力でも可"
          />
        </label>
        <label className="field">
          <span>体脂肪率 (%)</span>
          <input
            type="number"
            inputMode="decimal"
            value={bodyFat}
            onChange={(event) => setBodyFat(event.target.value)}
            placeholder="任意"
          />
        </label>
      </div>

      <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? '保存中…' : '今日の体を記録'}
      </button>

      {assessment.mode === 'unknown' && (
        <p className="note">
          身長体重が未入力のあいだは、体型は判定せず栄養の充足だけでキャラクターが育ちます。
        </p>
      )}

      {assessment.mode === 'adult' && (
        <dl className="stat-grid">
          <div>
            <dt>BMI</dt>
            <dd>{assessment.bmi}</dd>
          </div>
          <div>
            <dt>目標体重</dt>
            <dd>
              {assessment.targetWeightKg}kg
              {assessment.targetWeightRangeKg && (
                <small>
                  （{assessment.targetWeightRangeKg[0]}〜{assessment.targetWeightRangeKg[1]}kg）
                </small>
              )}
            </dd>
          </div>
          {assessment.targetBodyFatPercent !== null && (
            <div>
              <dt>目標体脂肪率</dt>
              <dd>
                {assessment.targetBodyFatPercent}%
                {assessment.bodyFatPercent !== null && <small>（今 {assessment.bodyFatPercent}%）</small>}
              </dd>
            </div>
          )}
          <div>
            <dt>いまの体型</dt>
            <dd>{assessment.shapeLabel}</dd>
          </div>
          {assessment.weightKg !== null && assessment.targetWeightKg !== null && (
            <div className="stat-note">
              <strong>{describeGap(assessment.weightKg, assessment.targetWeightKg, 'kg')}</strong>
              {assessment.bodyFatPercent !== null && assessment.targetBodyFatPercent !== null && (
                <>
                  {' ／ '}
                  <strong>
                    体脂肪率は{describeGap(
                      assessment.bodyFatPercent,
                      assessment.targetBodyFatPercent,
                      '%',
                    )}
                  </strong>
                </>
              )}
            </div>
          )}
        </dl>
      )}

      {assessment.mode === 'child' && (
        <dl className="stat-grid">
          <div>
            <dt>標準体重</dt>
            <dd>{assessment.standardWeightKg ?? '—'}kg</dd>
          </div>
          <div>
            <dt>肥満度</dt>
            <dd>{assessment.obesityRate !== null ? `${assessment.obesityRate}%` : '—'}</dd>
          </div>
          <div>
            <dt>いまの体型</dt>
            <dd>{assessment.shapeLabel}</dd>
          </div>
          <div className="stat-note">
            <small>成長期なので体重を減らす目標は設定していません。{CHILD_STANDARD_SOURCE}による判定です。</small>
          </div>
        </dl>
      )}

      {assessment.mode === 'child' && heightGoal && (
        <>
          <h3 className="card-subtitle">身長</h3>
          <dl className="stat-grid">
            <div>
              <dt>いまの身長</dt>
              <dd>{latestLog?.heightCm ?? profile.heightCm ?? '—'}cm</dd>
            </div>
            <div>
              <dt>目標身長</dt>
              <dd>
                {heightGoal.targetAdultHeightCm !== null
                  ? `${heightGoal.targetAdultHeightCm}cm`
                  : '未設定'}
                {heightGoal.predictedFromParentsCm !== null &&
                  profile.targetAdultHeightCm === null && <small>両親の身長からの予測</small>}
              </dd>
            </div>
            {heightGoal.remainingCm !== null && (
              <div>
                <dt>目標まで</dt>
                <dd>あと {heightGoal.remainingCm}cm</dd>
              </div>
            )}
            {heightVelocity ? (
              <div>
                <dt>1年あたりの伸び</dt>
                <dd>
                  {heightVelocity.centimetersPerYear}cm
                  <small>
                    {heightVelocity.spanDays}日で{heightVelocity.gainCm}cm
                    {velocityReference && `／目安 ${velocityReference[0]}〜${velocityReference[1]}cm`}
                  </small>
                </dd>
              </div>
            ) : (
              <div className="stat-note">
                <small>
                  身長の記録が2か月以上あいだを空けて2回そろうと、1年あたりの伸びを計算します。
                </small>
              </div>
            )}
            {heightGoal.predictedRangeCm !== null && (
              <div className="stat-note">
                <small>
                  両親の身長からの予測は {heightGoal.predictedFromParentsCm}cm、実際の到達身長は
                  およそ {heightGoal.predictedRangeCm[0]}〜{heightGoal.predictedRangeCm[1]}cm に広がります。
                  伸びが目安より明らかに遅いときは、目標を追うより小児科での成長曲線の確認をおすすめします。
                </small>
              </div>
            )}
          </dl>
        </>
      )}

      {isGrowthBoosted && (
        <p className="note">
          成長期ブーストが有効です。たんぱく質・カルシウム・ビタミンDの目標を推奨量より厚くしています。
          背を伸ばすためではなく、伸びしろを取りこぼさないための設定です。
        </p>
      )}

      {assessment.caution && <p className="alert">{assessment.caution}</p>}
    </section>
  );
}
