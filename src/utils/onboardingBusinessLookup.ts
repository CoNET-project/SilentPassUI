import type { VerraBusinessChannelKind } from '@/utils/verraBusinessProfileLocal'

const BEAMIO_API_BASE_URL = 'https://beamio.app/api'
export const ONBOARDING_WEB_CANDIDATE_SESSION_KEY = 'verra_onboarding_web_candidate_v1'

export type OnboardingBusinessLookupCandidate = {
	id: string
	name: string
	website: string
	snippet: string
	channelKind: VerraBusinessChannelKind | ''
	category: string
	orgType: 'sme' | 'franchise' | 'ngo' | ''
	country: string
	city: string
	province: string
	publicBio: string
	street: string
	phone: string
	email: string
	postalCode: string
}

type LookupOk = { ok: true; candidates: OnboardingBusinessLookupCandidate[] }
type LookupErr = { ok: false; error: string }

export type OnboardingLookupFilePayload = {
	filename: string
	mimeType: string
	dataBase64: string
}

export const ONBOARDING_LOOKUP_MAX_FILES = 3
export const ONBOARDING_LOOKUP_MAX_FILE_BYTES = Math.floor(1.5 * 1024 * 1024)
export const ONBOARDING_LOOKUP_MAX_TOTAL_BYTES = Math.floor(3.5 * 1024 * 1024)

export const ONBOARDING_LOOKUP_FILE_ACCEPT =
	'.pdf,.docx,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const CACHE_MS = 60_000
const cache = new Map<string, { at: number; result: LookupOk | LookupErr }>()
const inflight = new Map<string, Promise<LookupOk | LookupErr>>()

export function normalizeLookupQuery(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ')
}

export function lookupCacheKey(raw: string): string {
	return normalizeLookupQuery(raw).toLowerCase()
}

export function looksLikeWebsiteQuery(raw: string): boolean {
	const q = raw.trim()
	if (!q) return false
	if (/^https?:\/\//i.test(q)) return true
	if (q.includes('@') || /\s/.test(q)) return false
	return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(q)
}

export function shouldLookupOnboardingBusiness(raw: string): boolean {
	const q = normalizeLookupQuery(raw)
	if (q.length < 3) return false
	if (q.length > 200) return false
	return true
}

export function canSendOnboardingLookup(raw: string, fileCount: number): boolean {
	if (fileCount > 0) return fileCount <= ONBOARDING_LOOKUP_MAX_FILES
	return shouldLookupOnboardingBusiness(raw)
}

export type OnboardingLookupFileClass = 'ok' | 'legacy_word' | 'unsupported' | 'too_large'

export function classifyOnboardingLookupFile(file: File): OnboardingLookupFileClass {
	if (file.size > ONBOARDING_LOOKUP_MAX_FILE_BYTES) return 'too_large'
	const name = file.name.trim()
	if (/\.docx$/i.test(name)) return 'ok'
	if (/\.doc$/i.test(name)) return 'legacy_word'
	if (/\.(pdf|jpe?g|png|gif|webp)$/i.test(name)) return 'ok'
	const mime = file.type.toLowerCase()
	if (mime === 'application/msword') return 'legacy_word'
	if (
		mime === 'application/pdf' ||
		mime === 'image/jpeg' ||
		mime === 'image/png' ||
		mime === 'image/gif' ||
		mime === 'image/webp' ||
		mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	) {
		return 'ok'
	}
	return 'unsupported'
}

export function isOnboardingLookupImageFile(file: File): boolean {
	if (file.type.toLowerCase().startsWith('image/')) return true
	return /\.(jpe?g|png|gif|webp)$/i.test(file.name)
}

export function fileToOnboardingLookupBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const s = String(reader.result ?? '')
			const i = s.indexOf(',')
			resolve(i >= 0 ? s.slice(i + 1) : s)
		}
		reader.onerror = () => reject(reader.error ?? new Error('read_failed'))
		reader.readAsDataURL(file)
	})
}

function filesInflightKey(files: OnboardingLookupFilePayload[]): string {
	return files.map((f) => `${f.filename}:${f.dataBase64.length}`).join('|')
}

const PHYSICAL_CATS = [
	'food-beverage',
	'grocery-convenience',
	'fitness-wellness',
	'education-consulting',
	'entertainment-leisure',
	'health-beauty',
	'retail-shopping',
] as const
const DIGITAL_CATS = ['ecommerce-store', 'creator-kol', 'digital-services', 'freelance-agency'] as const
const APP_CATS = ['saas-platform', 'mobile-application', 'ai-ml-service', 'api-provider'] as const

const CATEGORY_ALIASES: Record<string, string> = {
	cafe: 'food-beverage',
	coffee: 'food-beverage',
	restaurant: 'food-beverage',
	food: 'food-beverage',
	'food & beverage': 'food-beverage',
	shanghainese: 'food-beverage',
	noodle: 'food-beverage',
	noodles: 'food-beverage',
	cuisine: 'food-beverage',
	eatery: 'food-beverage',
	bistro: 'food-beverage',
	diner: 'food-beverage',
	bakery: 'food-beverage',
	咖啡: 'food-beverage',
	餐厅: 'food-beverage',
	餐廳: 'food-beverage',
	餐饮: 'food-beverage',
	餐飲: 'food-beverage',
	美食: 'food-beverage',
	面馆: 'food-beverage',
	麵館: 'food-beverage',
	饭店: 'food-beverage',
	飯店: 'food-beverage',
	餐馆: 'food-beverage',
	餐館: 'food-beverage',
	酒楼: 'food-beverage',
	酒樓: 'food-beverage',
	茶馆: 'food-beverage',
	茶館: 'food-beverage',
	烧烤: 'food-beverage',
	燒烤: 'food-beverage',
	火锅: 'food-beverage',
	火鍋: 'food-beverage',
	grocery: 'grocery-convenience',
	convenience: 'grocery-convenience',
	fitness: 'fitness-wellness',
	gym: 'fitness-wellness',
	健身: 'fitness-wellness',
	education: 'education-consulting',
	consulting: 'education-consulting',
	entertainment: 'entertainment-leisure',
	salon: 'health-beauty',
	spa: 'health-beauty',
	barber: 'health-beauty',
	beauty: 'health-beauty',
	美容: 'health-beauty',
	美发: 'health-beauty',
	美髮: 'health-beauty',
	retail: 'retail-shopping',
	shop: 'retail-shopping',
	零售: 'retail-shopping',
	ecommerce: 'ecommerce-store',
	'e-commerce': 'ecommerce-store',
	creator: 'creator-kol',
	kol: 'creator-kol',
	saas: 'saas-platform',
	app: 'mobile-application',
	ai: 'ai-ml-service',
	api: 'api-provider',
}

const FOOD_NAME_RE =
	/restaurant|noodle|cuisine|cafe|coffee|bakery|bistro|diner|eatery|\bbar\b|\bpub\b|grill|kitchen|面馆|麵館|餐厅|餐廳|饭店|飯店|餐馆|餐館|酒楼|酒樓|咖啡|茶馆|茶館|烧烤|燒烤|火锅|火鍋|餐饮|餐飲|弄堂|小吃|料理|食堂|食府|菜馆|菜館|夜宵|本帮|本幫/

function publicLookupHaystack(c: OnboardingBusinessLookupCandidate, extraHint = ''): string {
	return [c.name, c.snippet, c.publicBio, extraHint].filter(Boolean).join('\n')
}

function channelForCategory(cat: string): VerraBusinessChannelKind | '' {
	if ((PHYSICAL_CATS as readonly string[]).includes(cat)) return 'physical'
	if ((DIGITAL_CATS as readonly string[]).includes(cat)) return 'digital'
	if ((APP_CATS as readonly string[]).includes(cat)) return 'app'
	return ''
}

function catsForChannel(kind: VerraBusinessChannelKind | ''): readonly string[] {
	if (kind === 'digital') return DIGITAL_CATS
	if (kind === 'app') return APP_CATS
	if (kind === 'physical') return PHYSICAL_CATS
	return [...PHYSICAL_CATS, ...DIGITAL_CATS, ...APP_CATS]
}

export function normalizeOnboardingCategory(kind: VerraBusinessChannelKind | '', raw: string): string {
	const allowed = catsForChannel(kind)
	const slug = raw.trim().toLowerCase().replace(/_/g, '-')
	if (allowed.includes(slug)) return slug
	const aliased = CATEGORY_ALIASES[slug] || CATEGORY_ALIASES[slug.replace(/\s+/g, ' ')]
	if (aliased && allowed.includes(aliased)) return aliased
	const tokens = slug.split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean)
	for (const t of tokens) {
		const hit = CATEGORY_ALIASES[t]
		if (hit && allowed.includes(hit)) return hit
	}
	return ''
}

/** Fill channel/category from public name / snippet. Never invents country. */
export function enrichLookupCandidateFromPublicName(
	c: OnboardingBusinessLookupCandidate,
	extraHint = '',
): OnboardingBusinessLookupCandidate {
	const catFromName = normalizeOnboardingCategory(c.channelKind, c.category || c.name)
	if (c.channelKind) {
		return c.category ? c : { ...c, category: catFromName }
	}
	let cat = catFromName
	const hay = publicLookupHaystack(c, extraHint)
	const n = hay.toLowerCase()
	if (!cat) {
		if (FOOD_NAME_RE.test(n) || FOOD_NAME_RE.test(hay)) cat = 'food-beverage'
		else if (/salon|spa|barber|clinic|beauty|美容|美发|美髮/.test(n) || /美容|美发|美髮/.test(hay)) {
			cat = 'health-beauty'
		} else if (/gym|fitness|yoga|健身/.test(n) || /健身/.test(hay)) cat = 'fitness-wellness'
	}
	const channel = channelForCategory(cat)
	if (!channel || !cat) return c
	return {
		...c,
		channelKind: channel,
		category: c.category || cat,
		orgType: c.orgType || (channel === 'physical' ? 'sme' : c.orgType),
	}
}

function mapCandidate(raw: unknown): OnboardingBusinessLookupCandidate | null {
	if (!raw || typeof raw !== 'object') return null
	const o = raw as Record<string, unknown>
	const name = String(o.name ?? '').trim()
	if (name.length < 2) return null
	const channelRaw = String(o.channelKind ?? '').trim()
	const channelKind: VerraBusinessChannelKind | '' =
		channelRaw === 'physical' || channelRaw === 'digital' || channelRaw === 'app' ? channelRaw : ''
	const orgRaw = String(o.orgType ?? '').trim()
	const orgType: 'sme' | 'franchise' | 'ngo' | '' =
		orgRaw === 'sme' || orgRaw === 'franchise' || orgRaw === 'ngo' ? orgRaw : ''
	return enrichLookupCandidateFromPublicName({
		id: String(o.id ?? name).trim() || name,
		name,
		website: String(o.website ?? '').trim(),
		snippet: String(o.snippet ?? '').trim(),
		channelKind,
		category: normalizeOnboardingCategory(channelKind, String(o.category ?? '')),
		orgType,
		country: String(o.country ?? '').trim(),
		city: String(o.city ?? '').trim(),
		province: String(o.province ?? '').trim(),
		publicBio: String(o.publicBio ?? '').trim(),
		street: String(o.street ?? '').trim().slice(0, 160),
		phone: String(o.phone ?? '').trim().slice(0, 40),
		email: String(o.email ?? '').trim().slice(0, 80),
		postalCode: String(o.postalCode ?? '').trim().slice(0, 12),
	})
}

export async function lookupOnboardingBusinesses(
	query: string,
	files?: OnboardingLookupFilePayload[],
): Promise<LookupOk | LookupErr> {
	const hasFiles = Boolean(files?.length)
	const key = hasFiles
		? `attach:${lookupCacheKey(query)}:${filesInflightKey(files!)}`
		: lookupCacheKey(query)
	if (!hasFiles) {
		const hit = cache.get(key)
		if (hit && Date.now() - hit.at < CACHE_MS) return hit.result
	}
	const pending = inflight.get(key)
	if (pending) return pending

	const run = (async (): Promise<LookupOk | LookupErr> => {
		try {
			const res = await fetch(`${BEAMIO_API_BASE_URL}/onboardingBusinessLookup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: normalizeLookupQuery(query),
					...(hasFiles ? { files } : {}),
				}),
			})
			const json = (await res.json().catch(() => null)) as
				| { ok?: boolean; candidates?: unknown; error?: string }
				| null
			if (res.status === 429) {
				return { ok: false, error: 'rate_limited' }
			}
			if (!res.ok || !json || json.ok === false) {
				return { ok: false, error: String(json?.error ?? 'lookup_failed') }
			}
			const candidates = Array.isArray(json.candidates)
				? json.candidates.map(mapCandidate).filter((c): c is OnboardingBusinessLookupCandidate => Boolean(c))
				: []
			const ok: LookupOk = { ok: true, candidates }
			if (!hasFiles) cache.set(key, { at: Date.now(), result: ok })
			return ok
		} catch {
			return { ok: false, error: 'network' }
		} finally {
			inflight.delete(key)
		}
	})()

	inflight.set(key, run)
	return run
}

export function saveOnboardingWebCandidate(candidate: OnboardingBusinessLookupCandidate): void {
	try {
		sessionStorage.setItem(ONBOARDING_WEB_CANDIDATE_SESSION_KEY, JSON.stringify(candidate))
	} catch {
		/* ignore quota */
	}
}

export function loadOnboardingWebCandidate(): OnboardingBusinessLookupCandidate | null {
	try {
		const raw = sessionStorage.getItem(ONBOARDING_WEB_CANDIDATE_SESSION_KEY)
		if (!raw) return null
		return mapCandidate(JSON.parse(raw) as unknown)
	} catch {
		return null
	}
}

export function clearOnboardingWebCandidate(): void {
	try {
		sessionStorage.removeItem(ONBOARDING_WEB_CANDIDATE_SESSION_KEY)
	} catch {
		/* ignore */
	}
}

export type OnboardingCardSetupAssets = {
	logoUrl: string
	backgroundUrl: string
	brandColor: string
	discoverCopy: string
}

export type OnboardingCardSetupRequest = {
	name: string
	website?: string
	snippet?: string
	publicBio?: string
	channelKind?: string
	category?: string
	country?: string
	city?: string
}

type CardSetupOk = { ok: true } & OnboardingCardSetupAssets
type CardSetupErr = { ok: false; error: string }

export async function fetchOnboardingCardSetupAssets(
	body: OnboardingCardSetupRequest,
): Promise<CardSetupOk | CardSetupErr> {
	try {
		const res = await fetch(`${BEAMIO_API_BASE_URL}/onboardingBusinessCardSetup`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const json = (await res.json()) as Record<string, unknown>
		if (json.ok === true) {
			return {
				ok: true,
				logoUrl: typeof json.logoUrl === 'string' ? json.logoUrl.trim() : '',
				backgroundUrl: typeof json.backgroundUrl === 'string' ? json.backgroundUrl.trim() : '',
				brandColor: typeof json.brandColor === 'string' ? json.brandColor.trim() : '',
				discoverCopy: typeof json.discoverCopy === 'string' ? json.discoverCopy.trim() : '',
			}
		}
		return {
			ok: false,
			error: typeof json.error === 'string' && json.error.trim() ? json.error.trim() : 'failed',
		}
	} catch {
		return { ok: false, error: 'network' }
	}
}
