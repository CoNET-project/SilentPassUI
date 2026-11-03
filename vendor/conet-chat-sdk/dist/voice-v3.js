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
import { base64ToBytes, bytesToBase64 } from './voice-channel-v2.js';
/** How long a payment signature stays valid (covers reconnects in a long call). */
export const VOICE_PAY_VALID_SEC = 12 * 60 * 60;
export const voicePayText = (temp, notAfter, maxBytes, maxSeconds) => [
    'conet.voice.sse.pay.v3',
    `temp=${temp.toLowerCase()}`,
    `notAfter=${notAfter}`,
    `maxBytes=${maxBytes}`,
    `maxSeconds=${maxSeconds}`,
].join('\n');
export const voiceListenText = (sessionId, wk, relayKeyId, timestamp) => ['conet.voice.sse.listen.v3', sessionId, wk, relayKeyId.toUpperCase(), String(timestamp)].join('|');
const randomHex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
/** New channel secrets: 32-hex locator, AES-256 key, HMAC write key. */
export const newVoiceChannelSecrets = () => ({
    sid: randomHex(16),
    key: bytesToBase64(crypto.getRandomValues(new Uint8Array(32))),
    wk: bytesToBase64(crypto.getRandomValues(new Uint8Array(32))),
});
/** New temporary wallet T and the payer's signature over it. */
export const newPaidVoiceChannel = async (payer, nowSec = Math.floor(Date.now() / 1000)) => {
    const temp = ethers.Wallet.createRandom();
    const notAfter = nowSec + VOICE_PAY_VALID_SEC;
    const sig = await payer.signMessage(voicePayText(temp.address, notAfter, 0, 0));
    return {
        ...newVoiceChannelSecrets(),
        tk: temp.privateKey,
        pay: { payer: payer.address.toLowerCase(), notAfter, maxBytes: 0, maxSeconds: 0, sig },
    };
};
/** The `voice_listen` v3 command for one own channel on `relayKeyId`. */
export const buildVoiceListenV3 = async (channel, relayKeyId, nowSec = Math.floor(Date.now() / 1000)) => {
    const temp = new ethers.Wallet(channel.tk);
    return {
        command: 'voice_listen',
        v: 3,
        sessionId: channel.sid,
        wk: channel.wk,
        timestamp: nowSec,
        temp: temp.address,
        tempSig: await temp.signMessage(voiceListenText(channel.sid, channel.wk, relayKeyId, nowSec)),
        pay: channel.pay,
    };
};
const validChannel = (c, own) => {
    if (!c || typeof c !== 'object')
        return false;
    const ch = c;
    if (!/^[0-9a-f]{32}$/.test(String(ch.sid || '')))
        return false;
    try {
        if (base64ToBytes(String(ch.key || '')).length !== 32)
            return false;
        if (base64ToBytes(String(ch.wk || '')).length !== 32)
            return false;
    }
    catch {
        return false;
    }
    if (!own)
        return true;
    const pay = ch.pay;
    return typeof ch.tk === 'string' && /^0x[0-9a-fA-F]{64}$/.test(ch.tk) &&
        !!pay && typeof pay.sig === 'string' && ethers.isAddress(String(pay.payer || '')) &&
        Number.isSafeInteger(pay.notAfter);
};
/** Shape check of `accept.ch` as the caller receives it. */
export const parseVoiceChannelsWire = (raw) => {
    if (!raw || typeof raw !== 'object')
        return null;
    const ch = raw;
    if (!validChannel(ch.cv, true) || !validChannel(ch.cV, true))
        return null;
    if (!validChannel(ch.ev, false) || !validChannel(ch.eV, false))
        return null;
    if (!ch.ev.relay || !ch.eV.relay)
        return null;
    return ch;
};
/** A short random AES key for the page's own frames (never leaves this device). */
export const newVoiceUiKey = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
//# sourceMappingURL=voice-v3.js.map