/**
 * Voice protocol v3: paid temporary SSE channels.
 *
 * The callee creates four channels when it answers (caller voice, caller
 * video, callee voice, callee video). Each channel has its own temporary
 * wallet T, AES key, write key and 16-byte locator. A payer wallet signs T
 * (`voicePayText`); T signs every `voice_listen` (`voiceListenText`) bound to
 * the relay's route key ID. The relay checks both signatures and `notAfter`.
 *
 * The caller picks the relay for its own two channels, the callee for its own
 * two. The callee hands the caller its two channels (T private key included)
 * inside the accept, which is a normal recipient-PGP chat message.
 *
 * Must match CoNET-SI `voiceForward.ts` (voicePayText / voiceListenText).
 */
import { ethers } from 'ethers';
/** How long a payment signature stays valid (covers reconnects in a long call). */
export declare const VOICE_PAY_VALID_SEC: number;
export type VoicePayAuth = {
    payer: string;
    notAfter: number;
    maxBytes: number;
    maxSeconds: number;
    sig: string;
};
/** One channel as the accept carries it. `tk` / `pay` only for channels the receiver opens. */
export type VoiceChannelWire = {
    sid: string;
    key: string;
    wk: string;
    tk?: string;
    pay?: VoicePayAuth;
    /** Relay route key ID (node domain), its IP and base64 armored route key. */
    relay?: string;
    relayIp?: string;
    relayKey?: string;
};
/** `cv`, `cV`: the caller listens. `ev`, `eV`: the callee listens. */
export type VoiceChannelsWire = {
    cv: VoiceChannelWire;
    cV: VoiceChannelWire;
    ev: VoiceChannelWire;
    eV: VoiceChannelWire;
};
/** A channel this side opens (listens on). */
export type VoiceOwnChannel = {
    sid: string;
    key: string;
    wk: string;
    tk: string;
    pay: VoicePayAuth;
    /** Relay route key ID (node domain). Empty: the worker picks one. */
    relay?: string;
};
/** A channel this side sends to. `relay` empty until the owner reports it. */
export type VoicePeerChannel = {
    sid: string;
    key: string;
    wk: string;
    relay?: string;
    relayIp?: string;
    /** base64 armored route key of the relay (used when our node table lacks it). */
    relayKey?: string;
};
/** Everything the chat worker needs to run a v3 call. Memory only. */
export type VoiceCallV3Config = {
    callId: string;
    /** AES key the page uses for its own frames; the worker re-keys per channel. */
    uiKey: string;
    role: 'caller' | 'callee';
    own: {
        voice: VoiceOwnChannel;
        video: VoiceOwnChannel;
    };
    peer: {
        voice: VoicePeerChannel;
        video: VoicePeerChannel;
    };
    /** Route keys (armored) of both mailboxes: never used as relay or entry. */
    avoidRoutes: string[];
};
export declare const voicePayText: (temp: string, notAfter: number, maxBytes: number, maxSeconds: number) => string;
export declare const voiceListenText: (sessionId: string, wk: string, relayKeyId: string, timestamp: number) => string;
/** New channel secrets: 32-hex locator, AES-256 key, HMAC write key. */
export declare const newVoiceChannelSecrets: () => {
    sid: string;
    key: string;
    wk: string;
};
/** New temporary wallet T and the payer's signature over it. */
export declare const newPaidVoiceChannel: (payer: ethers.Wallet, nowSec?: number) => Promise<VoiceOwnChannel>;
/** The `voice_listen` v3 command for one own channel on `relayKeyId`. */
export declare const buildVoiceListenV3: (channel: VoiceOwnChannel, relayKeyId: string, nowSec?: number) => Promise<Record<string, unknown>>;
/** Shape check of `accept.ch` as the caller receives it. */
export declare const parseVoiceChannelsWire: (raw: unknown) => VoiceChannelsWire | null;
/** A short random AES key for the page's own frames (never leaves this device). */
export declare const newVoiceUiKey: () => string;
//# sourceMappingURL=voice-v3.d.ts.map