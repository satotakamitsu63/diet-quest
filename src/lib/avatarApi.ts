import type { AvatarGoalPhysique } from './types';

export type GoalPhysique = AvatarGoalPhysique;

export const GOAL_PHYSIQUE_LABELS: Record<GoalPhysique, string> = {
  slim: 'スリム',
  athletic: 'アスレチック',
  muscular: '筋肉質',
};

/**
 * デスクトップで生成した10画像のローカルパス。
 * この関数は通信を一切行わない。生成物は .gitignore 対象で、開発中の端末だけに置く。
 */
export function localAvatarImagePath(profileId: string, level: number): string {
  const safeLevel = Math.max(1, Math.min(10, Math.round(level)));
  return `avatar-levels/${profileId}/${safeLevel}.png`;
}
