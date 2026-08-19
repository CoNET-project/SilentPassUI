import { useEffect, useId, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

type ProgramLivePreviewInlineFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  focusRingClass?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  rows?: number;
  hint?: string;
  displayValue?: string;
  className?: string;
  hideLabel?: boolean;
  displayClassName?: string;
  /** View-mode label when value is blank (never shows input placeholder publicly). */
  emptyDisplay?: string;
  /** Called when edit mode closes (blur or Escape). */
  onCommit?: () => void;
  /** Called immediately before entering edit mode (e.g. sync draft from displayed tier). */
  onEditStart?: () => void;
};

export function ProgramLivePreviewInlineField({
  label,
  value,
  onChange,
  disabled = false,
  multiline = false,
  maxLength,
  placeholder,
  focusRingClass = '',
  inputMode = 'text',
  rows = 3,
  hint,
  displayValue,
  className = '',
  hideLabel = false,
  displayClassName = '',
  emptyDisplay = 'Empty',
  onCommit,
  onEditStart,
}: ProgramLivePreviewInlineFieldProps) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const closeEditing = () => {
    setEditing(false);
    onCommit?.();
  };

  useEffect(() => {
    if (!editing) return;
    if (multiline) textareaRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, multiline]);

  const rawDisplay = (displayValue ?? value).trim();
  const hasContent = rawDisplay.length > 0;
  const shown = hasContent ? rawDisplay : emptyDisplay;
  const inputClass = `w-full rounded-lg border border-[#1562f0]/30 bg-white px-3 py-2 text-sm font-semibold text-[#2c2f31] outline-none transition-colors focus:border-[#1562f0] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${
    multiline ? 'resize-y font-medium leading-relaxed' : ''
  }`;

  if (editing && !disabled) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <label htmlFor={fieldId} className="block text-[9px] font-bold uppercase tracking-widest text-[#595c5e]">
          {label}
        </label>
        {multiline ? (
          <textarea
            id={fieldId}
            ref={textareaRef}
            rows={rows}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(maxLength != null ? e.target.value.slice(0, maxLength) : e.target.value)}
            onBlur={closeEditing}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeEditing();
            }}
            className={inputClass}
          />
        ) : (
          <input
            id={fieldId}
            ref={inputRef}
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(maxLength != null ? e.target.value.slice(0, maxLength) : e.target.value)}
            onBlur={closeEditing}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeEditing();
            }}
            className={inputClass}
          />
        )}
        {hint ? <p className="text-[10px] font-medium text-[#747779]">{hint}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onEditStart?.();
        setEditing(true);
      }}
      className={`group w-full rounded-lg text-left transition-colors hover:bg-[#1562f0]/[0.04] disabled:cursor-not-allowed disabled:opacity-60 ${className} ${focusRingClass}`}
      aria-label={`Edit ${label}`}
    >
      {!hideLabel ? (
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-widest text-[#595c5e]">{label}</span>
      ) : null}
      <span className="flex items-start justify-between gap-2">
        <span
          className={`min-w-0 flex-1 font-manrope text-sm font-bold leading-snug text-[#2c2f31] sm:text-base ${
            multiline ? 'whitespace-pre-line font-medium leading-relaxed text-xs sm:text-sm text-[#595c5e]' : 'text-lg sm:text-xl'
          } ${!hasContent ? 'font-normal italic text-[#747779]' : ''} ${displayClassName}`}
        >
          {shown}
        </span>
        {!disabled ? (
          <Pencil
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1562f0]/0 transition-all group-hover:text-[#1562f0]/70"
            strokeWidth={2.2}
            aria-hidden
          />
        ) : null}
      </span>
    </button>
  );
}

type ProgramLivePreviewInlineSelectProps<T extends string> = {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  focusRingClass?: string;
  className?: string;
  hideLabel?: boolean;
  displayClassName?: string;
  /** Called when edit mode closes (blur or Escape). */
  onCommit?: () => void;
};

export function ProgramLivePreviewInlineSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  focusRingClass = '',
  className = '',
  hideLabel = false,
  displayClassName = '',
  onCommit,
}: ProgramLivePreviewInlineSelectProps<T>) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const active = options.find((o) => o.value === value);

  const closeEditing = () => {
    setEditing(false);
    onCommit?.();
  };

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  if (editing && !disabled) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <label htmlFor={fieldId} className="block text-[9px] font-bold uppercase tracking-widest text-[#595c5e]">
          {label}
        </label>
        <select
          id={fieldId}
          ref={selectRef}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          onBlur={closeEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeEditing();
          }}
          className={`w-full rounded-lg border border-[#1562f0]/30 bg-white px-3 py-2 text-sm font-semibold text-[#2c2f31] outline-none focus:border-[#1562f0] ${focusRingClass}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {active?.description ? (
          <p className="text-[10px] leading-relaxed text-[#595c5e] sm:text-xs">{active.description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className={`group w-full rounded-lg text-left transition-colors hover:bg-[#1562f0]/[0.04] disabled:cursor-not-allowed disabled:opacity-60 ${className} ${focusRingClass}`}
      aria-label={`Edit ${label}`}
    >
      {!hideLabel ? (
        <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-widest text-[#595c5e]">{label}</span>
      ) : null}
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span
            className={`block font-manrope text-sm font-bold leading-snug text-[#2c2f31] sm:text-base ${displayClassName}`}
          >
            {active?.label ?? '—'}
          </span>
          {active?.description ? (
            <span className="mt-0.5 block text-[10px] leading-relaxed text-[#595c5e] sm:text-xs">
              {active.description}
            </span>
          ) : null}
        </span>
        {!disabled ? (
          <Pencil
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1562f0]/0 transition-all group-hover:text-[#1562f0]/70"
            strokeWidth={2.2}
            aria-hidden
          />
        ) : null}
      </span>
    </button>
  );
}
