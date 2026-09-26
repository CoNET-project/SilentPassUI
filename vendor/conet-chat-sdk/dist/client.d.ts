/**
 * Main-thread {@link BeamioChatClient} implementation. Boots the gossip Worker,
 * marshals commands, and re-emits worker events. Zero openpgp/verify on the main
 * thread — all heavy crypto runs in the worker.
 *
 * The host supplies the Worker instance (via `workerFactory`) so the SDK stays
 * bundler-agnostic: CRA/Vite/webpack each create the worker their own way, e.g.
 *   new Worker(new URL('@beamio/chat-sdk/worker', import.meta.url), { type: 'module' })
 */
import type { BeamioChatClient, BeamioChatConfig, NodeInfo } from './types.js';
export interface BeamioChatClientOptions {
    /**
     * Host-created Worker running `@beamio/chat-sdk/worker`. Required — the SDK never
     * hard-codes a worker URL so it works under any bundler / native shell.
     */
    workerFactory: () => Worker;
}
/** Factory: create a chat client. Call `init()` before use. */
export declare function createBeamioChatClient(config: BeamioChatConfig, options: BeamioChatClientOptions): BeamioChatClient & {
    setNodes(nodes: NodeInfo[]): void;
    postMailboxCommand(routerArmoredPublicKey: string, command: Record<string, unknown>): Promise<boolean>;
};
//# sourceMappingURL=client.d.ts.map