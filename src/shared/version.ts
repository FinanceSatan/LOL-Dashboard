/** Compares dotted versions like "1.10.0" and "v1.9.2". Returns >0 when a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .slice(0, 3)
      .map((x) => Number.parseInt(x, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Turns release notes (HTML or markdown, string or list) into plain text. */
export function plainNotes(notes: unknown): string {
  const text = Array.isArray(notes)
    ? notes.map((n) => (typeof n === 'string' ? n : String((n as { note?: string }).note ?? ''))).join('\n')
    : typeof notes === 'string'
      ? notes
      : ''
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2000)
}
