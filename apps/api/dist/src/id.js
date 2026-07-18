export function createId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
