import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlignVerticalSpaceAround, AlertTriangle, Check, Loader2, RectangleHorizontal } from 'lucide-react';
import {
  captureCouponStyleBannerFromHost,
  type CouponStyleBannerFillMode,
} from '@/utils/couponStyleBannerFillCanvas';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/40 focus-visible:ring-offset-2';

export type CatalogVideoOgPreviewBannerCaptureOverlayProps = {
  exportWidth: number;
  exportHeight: number;
  disabled?: boolean;
  activeSnapshotMode?: CouponStyleBannerFillMode | null;
  onCaptured: (args: { dataUrl: string; mode: CouponStyleBannerFillMode }) => void | Promise<void>;
  children: ReactNode;
};

type CaptureButtonStatus = 'idle' | 'loading' | 'success' | 'error';

function CaptureFitButton(props: {
  mode: CouponStyleBannerFillMode;
  disabled: boolean;
  status: CaptureButtonStatus;
  active: boolean;
  onClick: () => void;
}) {
  const isWidth = props.mode === 'width';
  const Icon = isWidth ? RectangleHorizontal : AlignVerticalSpaceAround;
  const label = isWidth ? 'Capture fit to width' : 'Capture fit to height';
  const hint = isWidth
    ? 'Fit banner width; fill top and bottom like coupon banner'
    : 'Fit banner height; fill left and right like coupon banner';

  let icon = <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />;
  if (props.status === 'loading') {
    icon = <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />;
  } else if (props.status === 'success') {
    icon = <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} aria-hidden />;
  } else if (props.status === 'error') {
    icon = <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={2.5} aria-hidden />;
  }

  return (
    <button
      type="button"
      title={hint}
      aria-label={label}
      disabled={props.disabled || props.status === 'loading'}
      onClick={props.onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-45 ${
        props.active
          ? 'border-[#ea580c] bg-[#ea580c]/85 ring-2 ring-white/80'
          : 'border-white/50 bg-black/50'
      } ${bizFocusRingClass}`}
    >
      {icon}
    </button>
  );
}

/** Two coupon-style snapshot controls over the Business Catalogs preview banner. */
export function CatalogVideoOgPreviewBannerCaptureOverlay(props: CatalogVideoOgPreviewBannerCaptureOverlayProps) {
  const { exportWidth, exportHeight, disabled, activeSnapshotMode = null, onCaptured, children } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [widthStatus, setWidthStatus] = useState<CaptureButtonStatus>('idle');
  const [heightStatus, setHeightStatus] = useState<CaptureButtonStatus>('idle');

  const runCapture = useCallback(
    (mode: CouponStyleBannerFillMode) => {
      const host = hostRef.current;
      if (!host || disabled) return;

      const setStatus = mode === 'width' ? setWidthStatus : setHeightStatus;
      setStatus('loading');

      void (async () => {
        try {
          const slotWidth = Math.max(1, Math.round(host.getBoundingClientRect().width));
          const width = slotWidth > 0 ? slotWidth : exportWidth;
          const dataUrl = await captureCouponStyleBannerFromHost(host, mode, width, exportHeight);
          await Promise.resolve(onCaptured({ dataUrl, mode }));
          setStatus('success');
          window.setTimeout(() => setStatus('idle'), 3000);
        } catch {
          setStatus('error');
          window.setTimeout(() => setStatus('idle'), 3000);
        }
      })();
    },
    [disabled, exportHeight, exportWidth, onCaptured]
  );

  const busy = widthStatus === 'loading' || heightStatus === 'loading';

  return (
    <div ref={hostRef} className="relative">
      {children}
      <div
        className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-end gap-1.5 px-2"
        role="toolbar"
        aria-label="Banner snapshot"
      >
        <div className="pointer-events-auto flex gap-1.5">
          <CaptureFitButton
            mode="width"
            disabled={disabled || busy}
            status={widthStatus}
            active={activeSnapshotMode === 'width'}
            onClick={() => runCapture('width')}
          />
          <CaptureFitButton
            mode="height"
            disabled={disabled || busy}
            status={heightStatus}
            active={activeSnapshotMode === 'height'}
            onClick={() => runCapture('height')}
          />
        </div>
      </div>
    </div>
  );
}
