/**
 * Plaintext shapes on the wire (before PGP encryption). Swift and Kotlin build
 * the same objects (`BeamioConetChatWire`); shared vectors:
 * `spec/chat-daemon-vectors.v1.json` (`builders`, `envelopes`).
 *
 * Literal encodings:
 *  - chat envelope (to the recipient user PGP): base64(UTF-8 JSON)
 *  - signed route command (to a route PGP):     base64(UTF-8 JSON { message, signMessage })
 *  - mailbox work (to the mailbox B route PGP): UTF-8 JSON (not base64)
 */
export function chatEnvelope(e) {
    return { timestamp: e.timestamp, text: e.text, from: e.from, signMessage: e.signMessage };
}
/** The signed middle row: `{ sendId, from: 'me', text, createdAt }`. */
export function pendingRow(sendId, text, createdAt) {
    return { sendId, from: 'me', text, createdAt };
}
/** `gossip_delivery_ack` to the own mailbox (deletes the offline copy). `timestamp` in seconds. */
export function deliveryAckCommand(eoa, armorHash, timestamp) {
    return { command: 'gossip_delivery_ack', walletAddress: eoa, armorHash, timestamp };
}
/** Receipt sent back to the sender as an ordinary NoPush chat message. `deliveredAt` in ms. */
export function deliveryReceipt(sendId, armorHash, deliveredAt, eoa) {
    return { type: 'beamio_chat_delivery_receipt_v1', sendId, armorHash, deliveredAt, from: eoa };
}
/** Mailbox work packet. `NoPush` is present only when true. */
export function mailboxWork(data, noPush) {
    return noPush ? { data, NoPush: true } : { data };
}
/** Signed route command literal object. */
export function routeCommandLiteral(message, signMessage) {
    return { message, signMessage };
}
//# sourceMappingURL=wire.js.map