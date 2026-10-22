import { Chip, type Tone } from './Chip';
import type { IconName } from './Icon';
import { useT } from '@/i18n/I18nProvider';

/** Status of a company's deletion, in the words the user sees. */
export const STATUS: Record<string, [Tone, IconName | null, string, string]> = {
  verified: ['ok', 'check', 'Verified', 'Verified deleted'],
  partial: ['part', 'half', 'Partly deleted', 'Partly deleted (kept by law)'],
  claimed: ['clm', 'mailc', 'Says deleted', 'Says deleted · being checked'],
  sent: ['pend', 'clock', 'Waiting', 'Waiting for reply'],
  'awaiting-reply': ['pend', 'clock', 'Waiting', 'Waiting for reply'],
  'action-needed': ['brand', 'globe', 'Web form', 'Submit web form'],
  'no-response': ['nr', 'alert', 'No response', 'No response'],
  overdue: ['ovd', 'timer', 'Overdue', 'Overdue'],
  refused: ['ovd', 'ban', 'Refused', 'Refused'],
  queued: ['neutral', 'clock', 'Draft', 'Draft'],
  'not-asked': ['neutral', null, 'Not asked', 'Not asked yet'],
  active: ['brand', 'refresh', 'In progress', 'In progress'],
  completed: ['ok', 'check', 'Completed', 'Completed'],
  draft: ['neutral', 'edit', 'Draft', 'Draft'],
  filed: ['brand', 'send', 'Filed', 'Filed'],
  leak: ['leak', 'siren', 'Leak', 'Leak']
};

export function StatusChip({ status, label, short }: { status: string; label?: string; short?: boolean }) {
  const t = useT();
  const [tone, icon, shortText, longText] = STATUS[status] || ['neutral', null, status, status];
  // `label` is shown as given (translate it before passing it in)
  return <Chip tone={tone} icon={icon || undefined}>{label ?? t(short ? shortText : longText)}</Chip>;
}
