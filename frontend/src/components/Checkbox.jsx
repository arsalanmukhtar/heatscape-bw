import { LuCheck } from 'react-icons/lu';

/* Square checkbox: a native input kept for keyboard and screen readers, drawn as a box. */
export function Checkbox({ checked, onChange, label }) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface-strong checked:border-layer-on checked:bg-layer-on"
      />
      {checked && <LuCheck size={12} strokeWidth={3} className="pointer-events-none relative text-on-accent" />}
    </span>
  );
}
