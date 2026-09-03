import { GROWTH_STAGE_NAMES } from '../art/mascot';
import { formatShortDate } from '../lib/dates';
import type { Profile } from '../lib/types';
import type { ProfileView } from '../logic/profileView';
import { CONDITION_LABELS, MAX_GROWTH_STAGE } from '../logic/score';
import { buildSuggestions } from '../logic/suggestions';
import { formatReviewRange } from '../logic/weeklyReview';
import { MascotArt } from './MascotArt';
import { NutrientBars } from './NutrientBars';

type Props = { profile: Profile; view: ProfileView };

export function HomeView({ profile, view }: Props) {
  const { character, today, history, assessment } = view;
  const suggestions = buildSuggestions(today);
  const recentWeek = history.slice(-7);

  return (
    <>
      <section className="card mascot-card">
        <MascotArt
          species={profile.species}
          shapeValue={character.shapeValue}
          growthStage={character.growthStage}
          condition={character.condition}
        />
        <div className="mascot-info">
          <h2 className="mascot-name">{profile.characterName}</h2>
          <p className="mascot-stage">
            Lv.{character.growthStage + 1} / {MAX_GROWTH_STAGE + 1}{' '}
            <strong>{GROWTH_STAGE_NAMES[character.growthStage]}</strong>
          </p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${character.progressToNextStage * 100}%` }} />
          </div>
          <p className="mascot-meta">
            {CONDITION_LABELS[character.condition]} ／ 体型：{assessment.shapeLabel}
            {character.streakDays > 0 && ` ／ 🔥${character.streakDays}日連続`}
          </p>
          {character.condition === 'exhausted' && (
            <p className="alert">
              食べる量が続けて足りていません。減らすほど育つ仕組みではないので、まず必要量まで戻してください。
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">
          今日のスコア {today.score === null ? '（まだ記録なし）' : `${today.score}点`}
          {view.todayPenalty < 0 && (
            <span className="penalty-chip">不足 {view.todayPenalty}点</span>
          )}
        </h2>
        <NutrientBars summary={today} />
      </section>

      {suggestions.length > 0 && (
        <section className="card">
          <h2 className="card-title">あと少し足りないもの</h2>
          <ul className="suggestion-list">
            {suggestions.map((suggestion) => (
              <li key={suggestion.nutrient}>
                <strong>
                  {suggestion.label} あと {suggestion.shortfall}
                  {suggestion.unit}
                </strong>
                <span>
                  {suggestion.foods
                    .map(
                      (entry) =>
                        `${entry.food.name}（${entry.food.servingLabel}で${
                          Math.round(entry.amountInServing * 10) / 10
                        }${suggestion.unit}）`,
                    )
                    .join('、')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">
          今週のふりかえり
          <span className="review-range">{formatReviewRange(view.weeklyReview)}</span>
        </h2>
        <div className="review-headline">
          <div>
            <span className="review-label">平均スコア</span>
            <strong>{view.weeklyReview.averageScore}点</strong>
          </div>
          <div>
            <span className="review-label">不足の合計（{view.weeklyReview.totalDays}日ぶん）</span>
            <strong className={view.weeklyReview.penaltyPoints < 0 ? 'is-penalty' : ''}>
              {view.weeklyReview.penaltyPoints}点
            </strong>
          </div>
          <div>
            <span className="review-label">記録できた日</span>
            <strong>
              {view.weeklyReview.recordedDays}/{view.weeklyReview.totalDays}日
            </strong>
          </div>
        </div>

        <ul className="advice-list">
          {view.weeklyReview.advice.map((entry, index) => (
            <li key={index} className={`advice is-${entry.kind}`}>
              <strong>{entry.headline}</strong>
              <p>{entry.detail}</p>
              {entry.actions.length > 0 && (
                <ul className="advice-actions">
                  {entry.actions.map((action, actionIndex) => (
                    <li key={actionIndex}>{action}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">この1週間</h2>
        <div className="week-strip">
          {recentWeek.map((summary) => (
            <div className="week-day" key={summary.date}>
              <div className="week-bar">
                <div
                  className="week-bar-fill"
                  style={{ height: `${summary.score ?? 0}%` }}
                  data-empty={summary.score === null}
                />
              </div>
              <span className="week-score">{summary.score ?? '—'}</span>
              <span className="week-label">{formatShortDate(summary.date)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
