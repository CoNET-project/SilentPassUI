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
/** Outer chat envelope. `signMessage` = EIP-191(`text`); it only ever travels inside the user-PGP layer (rule 22). */
export interface ChatEnvelope {
    timestamp: number;
    text: string;
    from: string;
    signMessage: string;
}
export declare function chatEnvelope(e: ChatEnvelope): ChatEnvelope;
/** The signed middle row: `{ sendId, from: 'me', text, createdAt }`. */
export declare function pendingRow(sendId: string, text: string, createdAt: number): {
    sendId: string;
    from: "me";
    text: string;
    createdAt: number;
};
/** `gossip_delivery_ack` to the own mailbox (deletes the offline copy). `timestamp` in seconds. */
export declare function deliveryAckCommand(eoa: string, armorHash: string, timestamp: number): {
    command: "gossip_delivery_ack";
    walletAddress: string;
    armorHash: string;
    timestamp: number;
};
/** Receipt sent back to the sender as an ordinary NoPush chat message. `deliveredAt` in ms. */
export declare function deliveryReceipt(sendId: string, armorHash: string, deliveredAt: number, eoa: string): {
    type: "beamio_chat_delivery_receipt_v1";
    sendId: string;
    armorHash: string;
    deliveredAt: number;
    from: string;
};
/** Mailbox work packet. `NoPush` is present only when true. */
export declare function mailboxWork(data: string, noPush: boolean): {
    data: string;
    NoPush?: true;
};
/** Signed route command literal object. */
export declare function routeCommandLiteral(message: string, signMessage: string): {
    message: string;
    signMessage: string;
};
//# sourceMappingURL=wire.d.ts.map