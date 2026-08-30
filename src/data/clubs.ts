export type ClubKey =
  | 'none' | 'ballet' | 'dance' | 'gymnastics' | 'swimming' | 'track'
  | 'soccer' | 'baseball' | 'basketball' | 'tennis' | 'volleyball'
  | 'kendo' | 'judo' | 'karate' | 'piano' | 'calligraphy' | 'board' | 'study' | 'gym';

/** 対戦のステータス名。battle.ts と共有するが、循環参照を避けてここで定義する。 */
export type StatKey = 'hp' | 'attack' | 'defense' | 'speed' | 'spirit';

export type Club = {
  label: string;
  /** その競技らしい必殺技の名前 */
  specialMoveName: string;
  /** 得意になるステータス */
  affinity: StatKey | null;
};

/** 部活・習い事ごとの必殺技と得意ステータス。 */
export const CLUBS: Record<ClubKey, Club> = {
  none: { label: '特になし', specialMoveName: 'たいあたり', affinity: null },
  ballet: { label: 'バレエ', specialMoveName: 'グラン・ジュテ', affinity: 'speed' },
  dance: { label: 'ダンス', specialMoveName: 'ステップラッシュ', affinity: 'speed' },
  gymnastics: { label: '体操', specialMoveName: 'バク宙キック', affinity: 'speed' },
  swimming: { label: '水泳', specialMoveName: 'バタフライアタック', affinity: 'hp' },
  track: { label: '陸上', specialMoveName: 'ラストスパート', affinity: 'speed' },
  soccer: { label: 'サッカー', specialMoveName: 'ボレーシュート', affinity: 'attack' },
  baseball: { label: '野球', specialMoveName: 'フルスイング', affinity: 'attack' },
  basketball: { label: 'バスケットボール', specialMoveName: 'ダンクシュート', affinity: 'speed' },
  tennis: { label: 'テニス', specialMoveName: 'スマッシュ', affinity: 'attack' },
  volleyball: { label: 'バレーボール', specialMoveName: 'スパイク', affinity: 'attack' },
  kendo: { label: '剣道', specialMoveName: 'めんあり！', affinity: 'spirit' },
  judo: { label: '柔道', specialMoveName: '一本背負い', affinity: 'defense' },
  karate: { label: '空手', specialMoveName: 'せいけんづき', affinity: 'attack' },
  piano: { label: 'ピアノ', specialMoveName: 'アルペジオ連打', affinity: 'spirit' },
  calligraphy: { label: '書道', specialMoveName: 'いっぴつ入魂', affinity: 'spirit' },
  board: { label: '将棋・囲碁', specialMoveName: 'つみの一手', affinity: 'spirit' },
  study: { label: '勉強・塾', specialMoveName: 'じゃくてん看破', affinity: 'spirit' },
  gym: { label: '筋トレ・ジム', specialMoveName: 'ベンチプレス', affinity: 'defense' },
};

export const CLUB_KEYS = Object.keys(CLUBS) as ClubKey[];

export type AwardCategory = 'sports' | 'study' | 'art';

export const AWARD_CATEGORY_LABELS: Record<AwardCategory, string> = {
  sports: 'スポーツ',
  study: '勉強',
  art: '芸術・その他',
};

export type AwardScale = 'school' | 'district' | 'prefecture' | 'national';

export const AWARD_SCALE_LABELS: Record<AwardScale, string> = {
  school: '校内・教室',
  district: '地区・市',
  prefecture: '県・地方',
  national: '全国・国際',
};

/** 規模ごとの評価点。 */
export const AWARD_SCALE_POINTS: Record<AwardScale, number> = {
  school: 1,
  district: 2,
  prefecture: 4,
  national: 8,
};
