import { useT } from '@/i18n/I18nProvider';
import { agoParts, cn } from '@/lib/format';
import { Button, Card, Icon } from '@/components/ui';
import type { ChatSummary } from '@/types/api';

/** Left column: start a new question or reopen an earlier one. */
export function ChatList({ chats, active, onNew, onOpen }: { chats: ChatSummary[]; active: string | null; onNew: () => void; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <Card className="gap-2 p-4 lg:sticky lg:top-6">
      <Button full onClick={onNew}><Icon name="plus" />{t('New question')}</Button>
      <span className="px-1.5 pb-0.5 pt-2.5 text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Recent')}</span>
      {chats.map(c => {
        const [tpl, n] = agoParts(c.at);
        return (
          <button key={c.id} onClick={() => onOpen(c.id)}
            className={cn('flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left', active === c.id ? 'bg-brand-s' : 'hover:bg-soft')}>
            <span className="clamp-2 text-sm font-semibold text-ink">{c.title}</span>
            <span className="text-[13px] text-mute">{t(tpl, { n })}</span>
          </button>
        );
      })}
      {!chats.length && <span className="px-1.5 text-[13px] text-mute">{t('Your questions will appear here.')}</span>}
    </Card>
  );
}
