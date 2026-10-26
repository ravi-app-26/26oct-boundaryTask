/**
 * An in-process event bus. THIS IS A STUB - you finish it.
 *
 * Requirements:
 *   - a handler that throws must not stop the other handlers
 *   - publish returns the number of handlers it reached
 *   - subscribing the same function twice registers it twice (do not dedupe)
 *   - publishing a name nobody listens to is fine and returns 0
 */

/** The events this system publishes. Add to it as you need to. */
export interface DomainEvents {
  "order.placed": { orderId: string; email: string; amountPaise: number };
}

export type EventName = keyof DomainEvents;
export type Handler<K extends EventName> = (payload: DomainEvents[K]) => void;
export type Unsubscribe = () => void;

export interface EventBus {
  publish<K extends EventName>(name: K, payload: DomainEvents[K]): number;
  subscribe<K extends EventName>(name: K, fn: Handler<K>): Unsubscribe;
}

export function createEventBus(): EventBus {
  const handlers = new Map<EventName, Handler<EventName>[]>();

  return {
    publish(name, payload) {
      const subscribers = handlers.get(name) ?? [];
      for (const handler of subscribers) {
        try { handler(payload); } catch { /* one failing handler must not stop the others */ }
      }
      return subscribers.length;
    },

    subscribe(name, fn) {
      const handler = fn as Handler<EventName>;
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      return () => {
        handlers.set(name, (handlers.get(name) ?? []).filter(h => h !== handler));
      };
    },
  };
}

export const events = createEventBus();