/**
 * Privacy-preserving group-chat V1 state helpers.
 *
 * V1 deliberately does not use OpenPGP multi-recipient encryption. Every
 * member receives an independently encrypted delivery so an entry or mailbox
 * only sees the single recipient key-id needed to route that one envelope.
 */
import { ethers } from 'ethers';
import type { GroupAdminProposalV1, GroupDeliveryPacketV1, GroupMessageV1, GroupRosterV1, GroupTombstoneV1 } from './types.js';
export declare const GROUP_V1_MAX_MEMBERS = 10;
export declare const GROUP_V1_DEFAULT_PADDING_BUCKET_BYTES = 4096;
export declare const GROUP_V1_MAX_BODY_BYTES: number;
type SignedGroupObject = {
    signer: string;
    signature: string;
};
/** Stable JSON used for EIP-191 signatures and roster hashes. */
export declare function canonicalGroupJson(value: unknown): string;
export declare function groupObjectSigningText(kind: string, value: unknown): string;
export declare function normalizeGroupAddress(value: string): string;
/** Hash of the full signed roster, suitable for chaining and message binding. */
export declare function groupRosterHash(roster: GroupRosterV1): string;
/**
 * Validate immutable V1 roster syntax and owner authorization. Applying it to
 * local state additionally requires version/prev-hash checks in
 * {@link assertNextGroupRosterV1}.
 */
export declare function assertGroupRosterV1(roster: GroupRosterV1, maxMembers?: number): void;
/** Reject skipped versions, forks, and replayed state before replacing local roster state. */
export declare function assertNextGroupRosterV1(current: GroupRosterV1 | null, next: GroupRosterV1): void;
export declare function signGroupObject<T extends SignedGroupObject>(wallet: ethers.Wallet, kind: string, unsigned: Omit<T, 'signer' | 'signature'>): Promise<T>;
export declare function createGroupMessageV1(wallet: ethers.Wallet, input: Omit<GroupMessageV1, 'type' | 'signer' | 'signature'>): Promise<GroupMessageV1>;
export declare function assertGroupMessageV1(message: GroupMessageV1, roster: GroupRosterV1, tombstone: GroupTombstoneV1 | null, now?: number): void;
export declare function assertGroupAdminProposalV1(proposal: GroupAdminProposalV1, roster: GroupRosterV1, now?: number): void;
export declare function assertGroupTombstoneV1(tombstone: GroupTombstoneV1, owner: string): void;
/**
 * Pad a per-recipient plaintext to a fixed byte bucket before PGP encryption.
 * Padding is random printable hex so JSON byte length is deterministic.
 */
export declare function createPaddedGroupDeliveryPacket(message: GroupMessageV1, bucketBytes?: number): GroupDeliveryPacketV1;
/** Validate the decrypted per-recipient wrapper before accepting its message. */
export declare function assertGroupDeliveryPacketV1(packet: GroupDeliveryPacketV1): void;
/**
 * Minimal recipient-local V1 group state. Hosts persist this state in their
 * encrypted chat store; this SDK keeps no roster/roster-history database.
 * A tombstone intentionally replaces the roster so a removed client cannot
 * continue treating its old local member list as current.
 */
export declare class GroupStateV1 {
    private roster;
    private tombstone;
    private readonly seenSendIds;
    get activeRoster(): GroupRosterV1 | null;
    get removalTombstone(): GroupTombstoneV1 | null;
    applyRoster(next: GroupRosterV1): void;
    applyTombstone(next: GroupTombstoneV1): void;
    acceptMessage(message: GroupMessageV1, now?: number): void;
    acceptDelivery(packet: GroupDeliveryPacketV1, now?: number): GroupMessageV1;
}
/** True when decrypted Chat text claims to be a V1 group object. */
export declare function looksLikeGroupText(text: string): boolean;
export type ClassifiedGroupPlaintext = {
    kind: 'roster';
    signer: string;
    roster: GroupRosterV1;
} | {
    kind: 'proposal';
    signer: string;
    proposal: GroupAdminProposalV1;
} | {
    kind: 'tombstone';
    signer: string;
    tombstone: GroupTombstoneV1;
} | {
    kind: 'message';
    signer: string;
    message: GroupMessageV1;
};
/**
 * Parse a decrypted Chat `text` body into a V1 group object.
 * Returns null when the JSON is not a group object. Throws when it claims to
 * be one but the shape is invalid. Signature checks stay with the assert helpers.
 */
export declare function classifyGroupPlaintext(text: string): ClassifiedGroupPlaintext | null;
export {};
//# sourceMappingURL=group.d.ts.map