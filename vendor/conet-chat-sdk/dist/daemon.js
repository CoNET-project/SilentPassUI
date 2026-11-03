/**
 * `hello` negotiation (page side) and the TS Worker's own `hello` answer.
 * Spec: `protocol.ts`. Shared vectors: `spec/chat-daemon-vectors.v1.json` (`hello`).
 */
import { CHAT_DAEMON_CAPABILITIES, CHAT_DAEMON_PROTOCOL_VERSION, CHAT_SDK_VERSION, } from './protocol.js';
/** Capabilities of the TS Worker daemon in this package. */
export const TS_WORKER_CAPABILITIES = [
    'history.v2',
    'voice.channelV2',
    'group.v1',
    'presence.query',
    'mailbox.command',
    'send.mailboxWrap',
];
export function tsWorkerHello() {
    return {
        protocolVersion: CHAT_DAEMON_PROTOCOL_VERSION,
        minProtocolVersion: CHAT_DAEMON_PROTOCOL_VERSION,
        sdkVersion: CHAT_SDK_VERSION,
        implementation: 'ts-worker',
        capabilities: [...TS_WORKER_CAPABILITIES],
    };
}
const LEGACY = {
    status: 'legacy',
    protocolVersion: 0,
    sdkVersion: '',
    implementation: '',
    capabilities: [],
};
const IMPLEMENTATIONS = ['ts-worker', 'ios', 'android'];
function isPositiveInt(v) {
    return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}
/**
 * Turn a `hello` answer (or `null` when none came) into {@link ChatDaemonFeatures}.
 * Unknown capabilities are dropped; a malformed answer counts as legacy.
 */
export function negotiateChatDaemon(reply, ourVersion = CHAT_DAEMON_PROTOCOL_VERSION) {
    if (!reply || typeof reply !== 'object' || Array.isArray(reply))
        return { ...LEGACY };
    const r = reply;
    if (!isPositiveInt(r.protocolVersion) || !Array.isArray(r.capabilities))
        return { ...LEGACY };
    const max = r.protocolVersion;
    const min = r.minProtocolVersion === undefined ? max : r.minProtocolVersion;
    if (!isPositiveInt(min) || min > max)
        return { ...LEGACY };
    const sdkVersion = typeof r.sdkVersion === 'string' ? r.sdkVersion : '';
    const implementation = typeof r.implementation === 'string' && IMPLEMENTATIONS.includes(r.implementation)
        ? r.implementation
        : '';
    if (min > ourVersion) {
        return { status: 'incompatible', protocolVersion: max, sdkVersion, implementation, capabilities: [] };
    }
    const offered = new Set(r.capabilities.filter((c) => typeof c === 'string'));
    const capabilities = CHAT_DAEMON_CAPABILITIES.filter((c) => offered.has(c));
    return { status: 'negotiated', protocolVersion: max, sdkVersion, implementation, capabilities };
}
export function hasCapability(features, cap) {
    return !!features && features.status === 'negotiated' && features.capabilities.includes(cap);
}
//# sourceMappingURL=daemon.js.map