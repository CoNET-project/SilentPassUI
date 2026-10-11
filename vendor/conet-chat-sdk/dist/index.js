/**
 * @conet.project/chat-sdk — public entry (main thread).
 *
 * Gossip messaging with all openpgp encrypt/decrypt + ethers signing running in a
 * Web Worker (zero main-thread crypto → no UI freeze) + encrypted fragmented IPFS
 * history. UI-agnostic; reusable across SilentPassUI / bizSite / Alliance / POS.
 *
 * Usage (host owns worker creation so the SDK stays bundler-agnostic):
 * ```ts
 * import { createBeamioChatClient } from '@conet.project/chat-sdk'
 * const client = createBeamioChatClient(config, {
 *   workerFactory: () => new Worker(new URL('@conet.project/chat-sdk/worker', import.meta.url), { type: 'module' }),
 * })
 * await client.init()
 * client.on('message', (env) => addNewMessage(env.line)) // host serial queue + checkSign
 * ```
 */
export { createBeamioChatClient } from './client.js';
export { armorToString, buildPostBody, encryptRouteCommand, wrapArmorToEntryRoute, wrapArmorToMailboxWork, wrapWouldHitSameNode, } from './envelope.js';
export { postUrl } from './nodes.js';
export { GROUP_V1_DEFAULT_PADDING_BUCKET_BYTES, GROUP_V1_MAX_BODY_BYTES, GROUP_V1_MAX_MEMBERS, GroupStateV1, assertGroupAdminProposalV1, assertGroupMessageV1, assertGroupRosterV1, assertNextGroupRosterV1, classifyGroupPlaintext, groupRosterHash, } from './group.js';
//# sourceMappingURL=index.js.map