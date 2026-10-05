import { LuCheck } from 'react-icons/lu';

/* Square checkbox: a native input kept for keyboard and screen readers, drawn as a box.
   size: sm 16 px (default) · md 20 px (labelled options) · lg 28 px (rows of 28 px controls). */
const SIZES = { sm: ['size-4', 12], md: ['size-5', 14], lg: ['size-7', 16] };

export function Checkbox({ checked, onChange, label, size = 'sm' }) {
  const [box, icon] = SIZES[size] ?? SIZES.sm;
  return (
    <span className={`relative grid shrink-0 place-items-center ${box}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface-strong checked:border-layer-on checked:bg-layer-on"
      />
      {checked && <LuCheck size={icon} strokeWidth={3} className="pointer-events-none relative text-on-accent" />}
    </span>
  );
}
