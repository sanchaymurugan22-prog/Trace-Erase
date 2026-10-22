// Drop zone for a Google Takeout .mbox file or a CSV of senders.
import { useRef, useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { Button, Icon } from '@/components/ui';
import { cn } from '@/lib/format';
import { parseUpload, type MailRow } from './parseUpload';

export function UploadMailList({ value, onChange }: { value: { name: string; rows: MailRow[] } | null; onChange: (v: { name: string; rows: MailRow[] } | null) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  const read = async (file?: File) => {
    if (!file) return;
    setReading(true);
    const text = await file.slice(0, 40 * 1024 * 1024).text();
    onChange({ name: file.name, rows: parseUpload(text, file.name) });
    setReading(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-s px-4 py-3">
        <Icon name="file" className="text-ok" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ink" translate="no">{value.name}</span>
          <span className="text-[13px] text-mute">{t('{n} emails read. Only sender and subject lines will be sent.', { n: value.rows.length })}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => { onChange(null); if (input.current) input.current.value = ''; }}>{t('Remove')}</Button>
      </div>
    );
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files?.[0]); }}
      className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition', drag ? 'border-brand bg-brand-s' : 'border-line2 bg-soft/60')}>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-card text-brand shadow-card"><Icon name="upload" /></span>
      <span className="text-sm font-semibold text-ink">{reading ? t('Reading the file…') : t('Drag a file here, or')}</span>
      <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={reading}><Icon name="file" size="sm" />{t('Choose a file')}</Button>
      <span className="text-xs text-mute">{t('Google Takeout .mbox, or a CSV with sender, subject, date')}</span>
      <input ref={input} type="file" accept=".mbox,.csv,.txt" className="hidden" onChange={e => read(e.target.files?.[0])} />
    </div>
  );
}
