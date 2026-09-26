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
import { createMessage, encrypt, enums, readKey, readMessage, } from 'openpgp';
import { utf8ToBase64 } from './crypto.js';
import { normalizeArmoredKey } from './nodes.js';
export function armorToString(armored) {
    if (typeof armored === 'string')
        return armored;
    if (armored && typeof armored === 'object' && 'data' in armored) {
        const data = armored.data;
        if (typeof data === 'string')
            return data;
    }
    return String(armored ?? '');
}
/** JSON body for `POST /post`. Wire is only `{ data }`. Never add sibling fields. */
export function buildPostBody(armored) {
    return { data: armored };
}
/**
 * Wrap user-PGP (or other) armor as a mailbox work packet encrypted to **B route PGP**.
 * SI on B decrypts this, reads `NoPush`, then stores/forwards the inner `data` armor.
 */
export async function wrapArmorToMailboxWork(innerArmor, mailboxRoutePublicKeyArmored, work) {
    const mailboxKey = normalizeArmoredKey(mailboxRoutePublicKeyArmored);
    if (!mailboxKey || !innerArmor.includes('BEGIN PGP')) {
        throw new Error('wrapArmorToMailboxWork: missing mailbox route key or inner armor');
    }
    const payload = { data: innerArmor };
    if (work?.NoPush)
        payload.NoPush = true;
    const encryptionKeys = await readKey({ armoredKey: mailboxRoutePublicKeyArmored });
    const pgpMsg = await createMessage({ text: JSON.stringify(payload) });
    return armorToString(await encrypt({
        message: pgpMsg,
        encryptionKeys,
        config: { preferredCompressionAlgorithm: enums.compression.zlib },
    }));
}
async function entryKeyIds(entryRoutePublicKeyArmored) {
    const key = await readKey({ armoredKey: entryRoutePublicKeyArmored });
    return new Set(key.getKeyIDs().map((id) => id.toHex().toUpperCase()));
}
/**
 * True when wrapping `innerArmor` to this entry would make the inner key ID
 * equal the entry (SI treats that as a same-node peel attack and emits `end`).
 */
export async function wrapWouldHitSameNode(innerArmor, entryRoutePublicKeyArmored) {
    if (!normalizeArmoredKey(entryRoutePublicKeyArmored) || !innerArmor.includes('BEGIN PGP')) {
        return true;
    }
    try {
        const innerMsg = await readMessage({ armoredMessage: innerArmor });
        const innerIds = innerMsg.getEncryptionKeyIDs().map((id) => id.toHex().toUpperCase());
        if (!innerIds.length)
            return true;
        const entryIds = await entryKeyIds(entryRoutePublicKeyArmored);
        return innerIds.some((id) => entryIds.has(id));
    }
    catch {
        return true;
    }
}
/**
 * Encrypt already-built inner OpenPGP armor to an entry route public key.
 * Literal plaintext is the **raw inner armor** (SI `tryReadInnerPgpMessage`).
 * Returns the inner armor unchanged when wrap is unsafe or encrypt fails.
 */
export async function wrapArmorToEntryRoute(innerArmor, entryRoutePublicKeyArmored) {
    const entryKey = normalizeArmoredKey(entryRoutePublicKeyArmored);
    if (!entryKey || !innerArmor.includes('BEGIN PGP'))
        return innerArmor;
    if (await wrapWouldHitSameNode(innerArmor, entryRoutePublicKeyArmored))
        return innerArmor;
    try {
        const encryptionKeys = await readKey({ armoredKey: entryRoutePublicKeyArmored });
        const pgpMsg = await createMessage({ text: innerArmor });
        return armorToString(await encrypt({
            message: pgpMsg,
            encryptionKeys,
            config: { preferredCompressionAlgorithm: enums.compression.zlib },
        }));
    }
    catch {
        return innerArmor;
    }
}
/** Signed SI command → OpenPGP armor encrypted to a **route** public key. */
export async function encryptRouteCommand(wallet, command, routePublicKeyArmored) {
    const message = JSON.stringify(command);
    const signMessage = await wallet.signMessage(message);
    const pgpMsg = await createMessage({
        text: utf8ToBase64(JSON.stringify({ message, signMessage })),
    });
    const encryptionKeys = await readKey({ armoredKey: routePublicKeyArmored });
    return armorToString(await encrypt({
        message: pgpMsg,
        encryptionKeys,
        config: { preferredCompressionAlgorithm: enums.compression.zlib },
    }));
}
/** Encrypt a voice route command without embedding a recoverable EOA signature. */
export async function encryptOpaqueVoiceCommand(command, routePublicKeyArmored) {
    const encryptionKeys = await readKey({ armoredKey: routePublicKeyArmored });
    const pgpMsg = await createMessage({
        text: utf8ToBase64(JSON.stringify(command)),
    });
    return armorToString(await encrypt({
        message: pgpMsg,
        encryptionKeys,
        config: { preferredCompressionAlgorithm: enums.compression.zlib },
    }));
}
//# sourceMappingURL=envelope.js.map