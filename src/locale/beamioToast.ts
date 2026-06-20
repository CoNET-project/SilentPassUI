import { Toast } from 'antd-mobile'
import { mapServerError } from './mapServerError'
import { tu } from './beamioLocale'

type ToastOpts = Parameters<typeof Toast.show>[0]

export function showBeamioToast(content: string, opts?: Omit<ToastOpts, 'content'>): void {
	Toast.show({ position: 'top', ...opts, content })
}

/** Localize known API / thrown error strings before showing toast. */
export function showBeamioToastError(
	raw: unknown,
	opts?: Omit<ToastOpts, 'content'>,
): void {
	Toast.show({
		position: 'top',
		...opts,
		content: mapServerError(raw),
	})
}

export function showBeamioToastUi(key: string, opts?: Omit<ToastOpts, 'content'>): void {
	showBeamioToast(tu(key), opts)
}

export { mapServerError, mapServerErrorOrFallback } from './mapServerError'
