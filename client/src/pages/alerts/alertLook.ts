import type { IconName } from '@/components/ui';
import type { Alert } from '@/types/api';

type TileTone = 'brand' | 'accent' | 'leak' | 'part' | 'nr' | 'ok' | 'neutral';

/** Icon and colour for each kind of alert. */
export const ALERT_LOOK: Record<string, [IconName, TileTone]> = {
  leak: ['siren', 'leak'],
  complaint: ['scale', 'nr'],
  reply: ['mailc', 'brand'],
  request: ['send', 'brand'],
  certificate: ['shieldc', 'ok'],
  deadline: ['timer', 'nr'],
  share: ['share', 'part'],
  scan: ['search', 'accent']
};

export function actionLabel(a: Alert) {
  if (a.type === 'leak') return 'Investigate';
  if (a.type === 'complaint') return 'Review complaint';
  if (a.type === 'certificate') return 'Get certificate';
  return 'Open';
}
