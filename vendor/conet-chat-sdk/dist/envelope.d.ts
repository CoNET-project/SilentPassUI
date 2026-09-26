/**
 * L0 / CoNET-SI envelope helpers (docs: `src/docs/gitbook/l0/si-developer-guide.md`).
 *
 * - Business armor: encrypt to recipient **user PGP**.
 * - SI command: `{ message, signMessage }` encrypt to **route PGP**.
 * - Mailbox work: `{ data: <user-PGP armor>, NoPush?: true }` encrypt to **mailbox B route PGP**.
 * - Optional outer wrap: encrypt already-built inner armor to **this entry's**
 *   route public key so the first `/post` observer sees the entry key ID.
 * - HTTP `POST /post` is **only** `{ data: armor }`. Never add sibling fields.
 * - Clients **must not** set `X-CoNET-Hop-Sigs` (SI appends that only on SI→SI).
 */
import type { Wallet } from 'ethers';
export declare function armorToString(armored: unknown): string;
/** JSON body for `POST /post`. Wire is only `{ data }`. Never add sibling fields. */
export declare function buildPostBody(armored: string): {
    data: string;
};
export type MailboxWorkEnvelope = {
    data: string;
    NoPush?: boolean;
};
/**
 * Wrap user-PGP (or other) armor as a mailbox work packet encrypted to **B route PGP**.
 * SI on B decrypts this, reads `NoPush`, then stores/forwards the inner `data` armor.
 */
export declare function wrapArmorToMailboxWork(innerArmor: string, mailboxRoutePublicKeyArmored: string, work?: {
    NoPush?: boolean;
}): Promise<string>;
/**
 * True when wrapping `innerArmor` to this entry would make the inner key ID
 * equal the entry (SI treats that as a same-node peel attack and emits `end`).
 */
export declare function wrapWouldHitSameNode(innerArmor: string, entryRoutePublicKeyArmored: string): Promise<boolean>;
/**
 * Encrypt already-built inner OpenPGP armor to an entry route public key.
 * Literal plaintext is the **raw inner armor** (SI `tryReadInnerPgpMessage`).
 * Returns the inner armor unchanged when wrap is unsafe or encrypt fails.
 */
export declare function wrapArmorToEntryRoute(innerArmor: string, entryRoutePublicKeyArmored: string): Promise<string>;
/** Signed SI command → OpenPGP armor encrypted to a **route** public key. */
export declare function encryptRouteCommand(wallet: Wallet, command: Record<string, unknown>, routePublicKeyArmored: string): Promise<string>;
/** Encrypt a voice route command without embedding a recoverable EOA signature. */
export declare function encryptOpaqueVoiceCommand(command: Record<string, unknown>, routePublicKeyArmored: string): Promise<string>;
//# sourceMappingURL=envelope.d.ts.map