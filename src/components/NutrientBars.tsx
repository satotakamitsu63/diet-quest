import { NUTRIENT_LABELS, NUTRIENT_UNITS, type NutrientKey } from '../data/nutrients';
import type { DailySummary } from '../logic/score';

const BOOSTED_KEYS: NutrientKey[] = [
  'protein',
  'calcium',
  'iron',
  'vitaminD',
  'fiber',
  'vitaminA',
  'vitaminB1',
  'vitaminB2',
  'vitaminC',
];

function formatValue(value: number, unit: string): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

function barClassFor(ratio: number): string {
  if (ratio >= 1) return 'nutrient-bar-fill is-met';
  if (ratio >= 0.7) return 'nutrient-bar-fill is-close';
  return 'nutrient-bar-fill is-short';
}

type Props = { summary: DailySummary };

export function NutrientBars({ summary }: Props) {
  const energyRatio = summary.ratios.energy;
  const saltRatio = summary.ratios.salt;

  return (
    <div className="nutrient-list">
      <div className="nutrient-row is-energy">
        <div className="nutrient-head">
          <span className="nutrient-name">エネルギー</span>
          <span className="nutrient-value">
            {formatValue(summary.totals.energy, 'kcal')} / {formatValue(summary.targets.energy, 'kcal')}
          </span>
        </div>
        <div className="nutrient-bar">
          <div
            className={
              energyRatio > 1.15
                ? 'nutrient-bar-fill is-over'
                : energyRatio >= 0.85
                  ? 'nutrient-bar-fill is-met'
                  : 'nutrient-bar-fill is-short'
            }
            style={{ width: `${Math.min(130, energyRatio * 100)}%` }}
          />
          <div className="nutrient-bar-marker" />
        </div>
      </div>

      {BOOSTED_KEYS.map((key) => {
        const target = summary.targets[key];
        if (target <= 0) return null;
        const ratio = summary.ratios[key];
        return (
          <div className="nutrient-row" key={key}>
            <div className="nutrient-head">
              <span className="nutrient-name">{NUTRIENT_LABELS[key]}</span>
              <span className="nutrient-value">
                {formatValue(summary.totals[key], NUTRIENT_UNITS[key])} /{' '}
                {formatValue(target, NUTRIENT_UNITS[key])}
              </span>
            </div>
            <div className="nutrient-bar">
              <div className={barClassFor(ratio)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
          </div>
        );
      })}

      <div className="nutrient-row">
        <div className="nutrient-head">
          <span className="nutrient-name">食塩相当量（少ないほどよい）</span>
          <span className="nutrient-value">
            {formatValue(summary.totals.salt, 'g')} / {formatValue(summary.targets.salt, 'g')}未満
          </span>
        </div>
        <div className="nutrient-bar">
          <div
            className={saltRatio > 1 ? 'nutrient-bar-fill is-over' : 'nutrient-bar-fill is-met'}
            style={{ width: `${Math.min(130, saltRatio * 100)}%` }}
          />
          <div className="nutrient-bar-marker" />
        </div>
      </div>
    </div>
  );
}
