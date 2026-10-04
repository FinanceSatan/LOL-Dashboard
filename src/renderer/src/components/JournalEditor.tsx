import clsx from 'clsx'
import { Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { JournalEntry, MatchSummary } from '@shared/types'
import { useT } from '@/i18n'
import { uid } from '@/lib/format'
import { GOOD_TAGS, MISTAKE_TAGS } from '@/lib/journal'
import { useApp } from '@/store/app'
import { Button, Field, TextArea, Toggle } from './ui'

const MENTAL = ['😣', '😕', '😐', '🙂', '😎']
const NO_ENTRIES: JournalEntry[] = []

function blank(match?: MatchSummary): JournalEntry {
  return {
    id: uid(),
    createdAt: Date.now(),
    matchId: match?.matchId,
    championId: match?.me.championId,
    win: match?.win,
    mental: 3,
    tags: [],
    went_well: '',
    improve: '',
    notes: '',
    reviewed: true
  }
}

export function JournalEditor({ match, entry, onDone }: { match?: MatchSummary; entry?: JournalEntry; onDone?: () => void }) {
  const t = useT()
  const journal = useApp((s) => s.data?.journal ?? NO_ENTRIES)
  const setJournal = useApp((s) => s.setJournal)
  const toast = useApp((s) => s.toast)
  const existing = entry ?? (match ? journal.find((j) => j.matchId === match.matchId) : undefined)
  const [draft, setDraft] = useState<JournalEntry>(existing ?? blank(match))

  useEffect(() => {
    setDraft(existing ?? blank(match))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.matchId, entry?.id])

  const toggleTag = (tag: string) =>
    setDraft((d) => ({ ...d, tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] }))

  const save = () => {
    const others = journal.filter((j) => j.id !== draft.id)
    setJournal([{ ...draft }, ...others].sort((a, b) => b.createdAt - a.createdAt))
    toast(t('journal.saved'), 'success')
    onDone?.()
  }

  const remove = () => {
    setJournal(journal.filter((j) => j.id !== draft.id))
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink2">{t('journal.mental')}</div>
          <div className="flex gap-1">
            {MENTAL.map((e, i) => (
              <button
                key={i}
                onClick={() => setDraft((d) => ({ ...d, mental: i + 1 }))}
                className={clsx(
                  'h-9 w-9 rounded-lg border text-lg transition-colors',
                  draft.mental === i + 1 ? 'border-gold bg-gold/15' : 'border-line bg-panel2 opacity-60 hover:opacity-100'
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={draft.reviewed} onChange={(v) => setDraft((d) => ({ ...d, reviewed: v }))} label={t('journal.vodReviewed')} />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-ink2">{t('journal.mistakes')}</div>
        <div className="flex flex-wrap gap-1.5">
          {MISTAKE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={clsx(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                draft.tags.includes(tag) ? 'border-bad/50 bg-bad/15 text-bad' : 'border-line2 text-ink2 hover:border-line2 hover:bg-panel2'
              )}
            >
              {t.d(`tag.${tag}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-ink2">{t('journal.goodThings')}</div>
        <div className="flex flex-wrap gap-1.5">
          {GOOD_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={clsx(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                draft.tags.includes(tag) ? 'border-good/50 bg-good/15 text-good' : 'border-line2 text-ink2 hover:bg-panel2'
              )}
            >
              {t.d(`tag.${tag}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t('journal.wentWell')}>
          <TextArea rows={3} value={draft.went_well} onChange={(e) => setDraft((d) => ({ ...d, went_well: e.target.value }))} placeholder={t('journal.wentWellPh')} />
        </Field>
        <Field label={t('journal.improve')}>
          <TextArea rows={3} value={draft.improve} onChange={(e) => setDraft((d) => ({ ...d, improve: e.target.value }))} placeholder={t('journal.improvePh')} />
        </Field>
      </div>
      <Field label={t('journal.notes')}>
        <TextArea rows={3} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder={t('journal.notesPh')} />
      </Field>
      <div className="flex items-center gap-2">
        <Button variant="primary" icon={<Save size={15} />} onClick={save}>
          {t('common.save')}
        </Button>
        {journal.some((j) => j.id === draft.id) && (
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </div>
  )
}
