/**
 * Log event router — the push side of `storage/projection-engine-v1.md` §3.
 *
 * The log is the single persistence choke point (local `storeEvent` and the
 * `nearbytes-sync` receive path both persist through it). After a successful
 * persist the log publishes the new event to matching subscribers. Routing is
 * O(1) per event per subscriber and never rescans the channel directory.
 */
import type { EventRouterFilter, EventRouterSink, StoredEventNotification } from '../api.js';

export interface EventRouter {
  subscribe(filter: EventRouterFilter, sink: EventRouterSink): () => void;
  publish(event: StoredEventNotification): void;
}

interface Subscription {
  readonly filter: EventRouterFilter;
  readonly sink: EventRouterSink;
}

function matches(filter: EventRouterFilter, event: StoredEventNotification): boolean {
  if (filter.channel !== undefined && filter.channel.toLowerCase() !== event.channelHex) {
    return false;
  }
  // `protocols` is a best-effort hint; payloads are encrypted at the router, so
  // it is not enforced here (subscribers ignore irrelevant events downstream).
  return true;
}

export function createEventRouter(): EventRouter {
  const subscriptions = new Set<Subscription>();
  return {
    subscribe(filter, sink) {
      const subscription: Subscription = { filter, sink };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },
    publish(event) {
      for (const subscription of subscriptions) {
        if (matches(subscription.filter, event)) {
          subscription.sink([event]);
        }
      }
    },
  };
}
