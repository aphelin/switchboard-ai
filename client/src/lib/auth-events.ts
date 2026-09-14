type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Tiny event bus for "the API said 401". Non-React code (the axios client, the
 * chat transport) reports it here; the AuthGate listens and re-checks the
 * session, which brings the sign-in modal back when the session is gone.
 */
export function notifyUnauthorized(): void {
  listeners.forEach((listener) => listener());
}

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
