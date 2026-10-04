/* Confidence of a modelled result: three square pips in the confidence colour (filled count
   = level, empty = outline) on a tint of it, plus the word. Colours come from --conf-*,
   a scale of their own (never heat levels or job states); pip count and word keep it
   readable without colour. level: High | Medium | Low.
   compact: pips only (for narrow table columns); the word stays in the tooltip and for
   screen readers. */
const FILLED = { High: 3, Medium: 2, Low: 1 };
const COLOR = { High: 'var(--conf-high)', Medium: 'var(--conf-medium)', Low: 'var(--conf-low)' };

export function ConfidencePips({ level, label, compact = false }) {
  const filled = FILLED[level] ?? 0;
  const color = COLOR[level] ?? 'var(--text-muted)';
  const word = label ?? level;
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center justify-center gap-1.5 border px-1.5 text-2xs font-medium"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
        // Same width as every chip (pips + word centred as one group); compact = pips only.
        width: compact ? 'var(--chip-compact-w)' : 'var(--level-chip-w)',
      }}
      title={word}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 border" style={{ borderColor: color, background: i < filled ? color : 'transparent' }} />
        ))}
      </span>
      <span className={compact ? 'sr-only' : undefined}>{word}</span>
    </span>
  );
}
