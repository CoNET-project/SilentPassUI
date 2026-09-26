/**
 * Worker entry — side-effectful. Import ONLY inside a Worker context
 * (`new Worker(new URL('.../worker/entry.js', import.meta.url), { type: 'module' })`).
 *
 * All openpgp encrypt/decrypt + ethers signing/verify-free hot paths live here so the
 * main thread stays responsive. Bridges {@link WorkerInbound} commands to {@link WorkerOutbound}
 * events via `postMessage`.
 */
export {};
//# sourceMappingURL=entry.d.ts.map