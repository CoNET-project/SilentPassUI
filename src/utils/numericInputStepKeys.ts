import type { KeyboardEvent, WheelEvent } from 'react';

function isNumericStepKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  return (
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'PageUp' ||
    e.key === 'PageDown' ||
    e.key === 'Home' ||
    e.key === 'End' ||
    e.code === 'ArrowUp' ||
    e.code === 'ArrowDown' ||
    e.code === 'PageUp' ||
    e.code === 'PageDown' ||
    e.code === 'Home' ||
    e.code === 'End'
  );
}

/**
 * Attach to `type="number"` as `onKeyDown={preventNumericInputStepKeys}` (and optionally
 * `onKeyDownCapture={preventNumericInputStepKeys}` if a parent still receives the event first).
 * Also use `onWheel={preventNumericInputWheelStep}` where focus + wheel must not change the value (Chrome).
 * @see `.cursor/rules/beamio-numeric-input-ui-role.mdc`
 */
export function preventNumericInputStepKeys(e: KeyboardEvent<HTMLInputElement>): void {
  if (!isNumericStepKey(e)) return;
  e.preventDefault();
  e.stopPropagation();
}

/** Block wheel / trackpad from stepping `type="number"` while focused (esp. Chromium). */
export function preventNumericInputWheelStep(e: WheelEvent<HTMLInputElement>): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * React's synthetic `onWheel` may be **passive**, so `preventDefault()` does not block Chromium
 * from stepping `type="number"`. Use one instance per `<input>` via `ref={callback}`:
 * `const cb = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])`.
 */
export function createNumericInputWheelNonPassiveRefCallback(): (el: HTMLInputElement | null) => void {
  let detach: (() => void) | undefined;
  return (el: HTMLInputElement | null) => {
    detach?.();
    detach = undefined;
    if (!el) return;
    const onWheel: EventListener = (e) => {
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    detach = () => {
      el.removeEventListener('wheel', onWheel);
    };
  };
}
