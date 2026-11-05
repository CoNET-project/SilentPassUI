/**
 * Entries for one call's media frames (same rules as the iOS / Android shells'
 * `BeamioEntryLatencyBand`).
 *
 * Every frame still goes through a random entry, but only among a few entries
 * picked at random for this call whose post times are close to the fastest.
 * Mixing a 300 ms entry with a 700 ms one put a third of the frames out of
 * order at the peer (2026-11-05: post time spread ~150 ms with random entries,
 * ~20 ms within a band). A new call picks a new set.
 *
 * Privacy: the candidate set is narrowed per call to the measured fast entries
 * (random candidates, at most 12 tried per call, frames on entries within 50 ms
 * of the fastest); the entry still changes frame to frame (never twice in a
 * row) and the set is thrown away when the call ends.
 */
/** Post-time samples an entry needs before it is judged. */
export declare const ENTRY_BAND_MIN_SAMPLES = 3;
/**
 * Kept: average ≤ fastest × ratio + slack. Narrower than one 80 ms frame, so
 * frames on different band entries rarely overtake each other.
 */
export declare const ENTRY_BAND_RATIO = 1;
export declare const ENTRY_BAND_SLACK_MS = 50;
/** Never fewer than this many entries in the band. */
export declare const ENTRY_BAND_MIN_KEEP = 2;
/** Look for more candidates until this many are close to the fastest. */
export declare const ENTRY_BAND_WANT = 3;
/** One pick in this many measures a not-yet-measured candidate. */
export declare const ENTRY_BAND_PROBE_EVERY = 8;
/** Entries tried at the start of a call (and refilled to). */
export declare const ENTRY_POOL_TARGET = 6;
/** Candidates tried per call at most while looking for close entries. */
export declare const ENTRY_POOL_MAX_TRIED = 12;
/**
 * Entries allowed to carry the next frame. `pickIndex` counts picks in this call.
 * Warm-up (first target × min-samples picks, or fewer than two measured): all.
 */
export declare function entryLatencyBand(entries: string[], ewma: ReadonlyMap<string, number>, samples: ReadonlyMap<string, number>, pickIndex: number, poolTarget?: number): string[];
/** Measured entries within the band limit (before the minimum-two rule). */
export declare function entriesCloseToFastest(entries: string[], ewma: ReadonlyMap<string, number>, samples: ReadonlyMap<string, number>): string[];
/** Random member of `band`, not `last` when there is a choice. */
export declare function pickFromBand(band: string[], last: string | null, random?: () => number): string | null;
/** Per-call entry pool for media frames. Holds no state beyond the call. */
export declare class VoiceEntryPool<N extends {
    domain: string;
}> {
    /** Random candidates, none in `exclude` (the SDK's healthy-entry picker). */
    private readonly pickCandidates;
    private readonly random;
    private nodes;
    private readonly ewma;
    private readonly samples;
    private readonly dropped;
    private last;
    private pickIndex;
    private tried;
    private refilling;
    constructor(
    /** Random candidates, none in `exclude` (the SDK's healthy-entry picker). */
    pickCandidates: (count: number, exclude: Set<string>) => Promise<N[]>, random?: () => number);
    get size(): number;
    /** Entry for the next frame; never one in `exclude` (relay, mailboxes, already tried). */
    next(exclude: Set<string>): Promise<N | null>;
    /** One post through `domain`: its time, or a failure (the entry leaves this call's pool). */
    record(domain: string, ms: number, ok: boolean): void;
    /** Diagnostics: entries in the pool with their average post time. */
    snapshot(): Array<{
        domain: string;
        ms: number | null;
        samples: number;
    }>;
    /**
     * Fewer than three measured entries close to the fastest, every candidate
     * measured, and the per-call budget not used up: try two more. Entries far
     * outside the band then leave the pool so it stays small.
     */
    private needsCloserEntries;
    private refill;
}
//# sourceMappingURL=voice-entry-pool.d.ts.map