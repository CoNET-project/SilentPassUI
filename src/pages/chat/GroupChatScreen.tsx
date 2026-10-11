import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Users } from 'lucide-react'

import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import {
	createGroupChat,
	endGroupChat,
	listGroupChats,
	sendGroupChatMessage,
	subscribeGroupChats,
	type StoredGroupV1,
} from '@/services/conetGroupChat'
import type { ChatRoute } from '@conet.project/chat-sdk'

type Props = {
	chats: chatData[]
	ownEoa: string
	onClose: () => void
}

function shortAddress(value: string): string {
	const addr = value.trim()
	if (addr.length < 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function routesFor(chats: chatData[], eoas: string[]): ChatRoute[] {
	const wanted = new Set(eoas.map((eoa) => eoa.toLowerCase()))
	return chats.flatMap((chat) => {
		const address = chat.address?.trim() ?? ''
		const armored = chat.chatData?.publicArmored?.trim() ?? ''
		const routeKey = chat.chatData?.routersArmoreds?.trim() ?? ''
		if (!address || !armored || !routeKey || !wanted.has(address.toLowerCase())) return []
		return [{
			address,
			userPublicKeyArmored: armored,
			routerArmoredPublicKey: chat.chatData.routersArmoreds || undefined,
		}]
	})
}

export default function GroupChatScreen({ chats, ownEoa, onClose }: Props) {
	const { resolveTagPlain } = useBeamioTagDatabase()
	const [groups, setGroups] = useState<StoredGroupV1[]>(() => listGroupChats())
	const [mode, setMode] = useState<'list' | 'create' | 'thread'>('list')
	const [openId, setOpenId] = useState('')
	const [name, setName] = useState('')
	const [selected, setSelected] = useState<string[]>([])
	const [draft, setDraft] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	useEffect(() => subscribeGroupChats(() => setGroups(listGroupChats())), [])

	const open = groups.find((group) => group.roster.groupId === openId) ?? null
	const candidates = useMemo(
		() => chats.filter((chat) => chat.chatData?.publicArmored?.trim() && chat.chatData?.routersArmoreds?.trim() && chat.address?.trim()),
		[chats],
	)
	const labelFor = (eoa: string) => {
		const tag = resolveTagPlain(eoa).replace(/^@+/, '')
		return tag ? `@${tag}` : shortAddress(eoa)
	}

	const back = () => {
		setError('')
		setNotice('')
		if (mode === 'list') onClose()
		else setMode('list')
	}

	const create = async () => {
		if (busy) return
		setBusy(true)
		setError('')
		setNotice('')
		try {
			const result = await createGroupChat({
				name,
				memberEoas: selected,
				routes: routesFor(chats, selected),
			})
			setName('')
			setSelected([])
			setMode('list')
			if (result.failedRecipients > 0) {
				setNotice(`Group created. ${result.failedRecipients} member${result.failedRecipients === 1 ? '' : 's'} did not receive the roster.`)
			}
		} catch (ex) {
			setError((ex as Error)?.message || 'Could not create the group')
		} finally {
			setBusy(false)
		}
	}

	const send = async () => {
		if (busy || !open) return
		setBusy(true)
		setError('')
		setNotice('')
		try {
			const memberEoas = open.roster.members.map((member) => member.eoa)
			const result = await sendGroupChatMessage(open.roster.groupId, draft, routesFor(chats, memberEoas))
			setDraft('')
			if (result.failedRecipients > 0) {
				setNotice(`Sent to ${result.acceptedRecipients}. ${result.failedRecipients} did not receive this message.`)
			}
		} catch (ex) {
			setError((ex as Error)?.message || 'Could not send the message')
		} finally {
			setBusy(false)
		}
	}

	const end = async () => {
		if (busy || !open) return
		setBusy(true)
		setError('')
		setNotice('')
		try {
			const memberEoas = open.roster.members.map((member) => member.eoa)
			await endGroupChat(open.roster.groupId, routesFor(chats, memberEoas))
			setNotice('Group closed.')
		} catch (ex) {
			setError((ex as Error)?.message || 'Could not close the group')
		} finally {
			setBusy(false)
		}
	}

	const canCreate = name.trim().length > 0 && selected.length > 0 && selected.length <= 9 && !busy
	const isOwner = open ? open.roster.policy.owner.toLowerCase() === ownEoa.toLowerCase() : false

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#F1F8ED]">
			<div className="px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
				<div className={BEAMIO_CIRCULAR_BACK_ROW_CLASS}>
					<BeamioCircularBackButton variant="onLight" onClick={back} className="absolute left-0 top-0" />
				</div>
				<header className="pb-4">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Messages</p>
					<h1 className="mt-1 text-3xl font-semibold text-slate-900">
						{mode === 'create' ? 'New group' : mode === 'thread' ? open?.roster.policy.name || 'Group' : 'Group chats'}
					</h1>
				</header>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
				{error ? (
					<div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						{error}
					</div>
				) : null}
				{notice ? (
					<div role="status" className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
						{notice}
					</div>
				) : null}
				{mode === 'list' ? (
					<div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
						<button
							type="button"
							onClick={() => { setMode('create'); setError(''); setNotice('') }}
							className="rounded-2xl bg-[#1562f0] px-4 py-3 text-left text-sm font-semibold text-white"
						>
							New group
						</button>
						{groups.length === 0 ? (
							<p className="px-1 text-sm text-slate-500">Groups you create or join appear here. A group can include up to 10 people.</p>
						) : groups.map((group) => (
							<button
								key={group.roster.groupId}
								type="button"
								onClick={() => { setOpenId(group.roster.groupId); setMode('thread'); setError(''); setNotice('') }}
								className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm"
							>
								<span className="grid h-10 w-10 place-items-center rounded-full bg-[#e9edff] text-[#0051d1]">
									<Users className="h-5 w-5" aria-hidden />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-semibold text-slate-900">{group.roster.policy.name}</span>
									<span className="block truncate text-sm text-slate-500">
										{group.tombstone ? 'Closed' : `${group.roster.members.length} members`}
										{group.messages.length ? ` · ${group.messages[group.messages.length - 1]?.body ?? ''}` : ''}
									</span>
								</span>
							</button>
						))}
					</div>
				) : null}
				{mode === 'create' ? (
					<form
						id="group-create-form"
						className="mx-auto flex w-full max-w-[820px] flex-col gap-4"
						onSubmit={(event) => { event.preventDefault(); void create() }}
					>
						<label htmlFor="group-name" className="text-sm font-semibold text-slate-700">Group name</label>
						<input
							id="group-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							tabIndex={1}
							enterKeyHint="next"
							autoComplete="off"
							className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
							placeholder="Group name"
						/>
						<p className="text-sm font-semibold text-slate-700">Members</p>
						<p className="text-sm text-slate-500">Choose people you already chat with. You are included. Maximum 9 others.</p>
						<div className="flex flex-col gap-2">
							{candidates.map((chat) => {
								const address = chat.address
								const checked = selected.some((eoa) => eoa.toLowerCase() === address.toLowerCase())
								return (
									<button
										key={address}
										type="button"
										tabIndex={-1}
										aria-pressed={checked}
										onClick={() => {
											setSelected((current) => {
												if (current.some((eoa) => eoa.toLowerCase() === address.toLowerCase())) {
													return current.filter((eoa) => eoa.toLowerCase() !== address.toLowerCase())
												}
												if (current.length >= 9) return current
												return [...current, address]
											})
										}}
										className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-left"
									>
										<span className="font-medium text-slate-900">{labelFor(address)}</span>
										{checked ? <Check className="h-4 w-4 text-[#0051d1]" aria-hidden /> : null}
									</button>
								)
							})}
						</div>
						<button
							type="submit"
							tabIndex={2}
							disabled={!canCreate}
							aria-busy={busy}
							aria-label="Create group"
							className="rounded-full bg-[#1562f0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
						>
							{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : 'Create group'}
						</button>
					</form>
				) : null}
				{mode === 'thread' && open ? (
					<div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
						<p className="text-sm text-slate-500">
							{open.roster.members.map((member) => labelFor(member.eoa)).join(', ')}
						</p>
						{open.proposals.length && !open.tombstone ? (
							<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
								{open.proposals.length} admin proposal{open.proposals.length === 1 ? '' : 's'} waiting. Only the owner can issue the next roster.
							</div>
						) : null}
						<div className="flex flex-col gap-2">
							{open.messages.map((message) => {
								const mine = message.signer.toLowerCase() === ownEoa.toLowerCase()
								return (
									<div key={`${message.sendId}:${message.seq}`} className={mine ? 'flex justify-end' : 'flex justify-start'}>
										<div className={mine ? 'max-w-[80%] rounded-2xl bg-[#1562f0] px-3 py-2 text-sm text-white' : 'max-w-[80%] rounded-2xl bg-white px-3 py-2 text-sm text-slate-900'}>
											<p className="mb-1 text-xs opacity-70">{labelFor(message.signer)}</p>
											<p className="whitespace-pre-wrap break-words">{message.body}</p>
										</div>
									</div>
								)
							})}
						</div>
						{open.tombstone ? <p className="text-sm text-slate-500">This group is closed.</p> : (
							<form
								id="group-compose-form"
								className="mt-2 flex flex-col gap-2"
								onSubmit={(event) => { event.preventDefault(); void send() }}
							>
								<label htmlFor="group-message" className="sr-only">Message</label>
								<textarea
									id="group-message"
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									tabIndex={1}
									enterKeyHint="send"
									rows={3}
									className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
									placeholder="Message"
								/>
								<button
									type="submit"
									tabIndex={2}
									disabled={busy || !draft.trim()}
									aria-busy={busy}
									aria-label="Send"
									className="rounded-full bg-[#1562f0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
								>
									{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : 'Send'}
								</button>
								{isOwner ? (
									<button
										type="button"
										tabIndex={3}
										onClick={() => void end()}
										disabled={busy}
										className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-rose-700"
									>
										Close group
									</button>
								) : null}
							</form>
						)}
					</div>
				) : null}
			</div>
		</div>
	)
}
