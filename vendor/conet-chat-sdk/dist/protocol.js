/**
 * postMessage protocol between the main-thread {@link BeamioChatClient} and the
 * gossip Worker. All heavy crypto (openpgp encrypt/decrypt, ethers verify/sign)
 * runs in the worker; the main thread only marshals commands and re-emits events.
 */
export {};
//# sourceMappingURL=protocol.js.map