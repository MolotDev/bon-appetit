import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CreateOrderPayload = {
  userId: string;
  date: string;
  locationId: string;
  dailyMenuIds: string[];
  existingOrderId: string | null;
};

export type CancelOrderPayload = {
  userId: string;
  date: string;
  orderId: string;
};

export type SyncQueueItem =
  | {
      id: string;
      type: "CREATE_ORDER";
      payload: CreateOrderPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "CANCEL_ORDER";
      payload: CancelOrderPayload;
      createdAt: string;
    };

type OrderStoreState = {
  syncQueue: SyncQueueItem[];
  enqueue: (item: Omit<SyncQueueItem, "id" | "createdAt"> & { id?: string; createdAt?: string }) => string;
  remove: (id: string) => void;
  clear: () => void;
  hasQueuedAction: (userId: string, date: string) => boolean;
};

function newId(): string {
  return crypto.randomUUID();
}

export const LOCAL_ORDER_PREFIX = "local-";

export function isLocalOrderId(orderId: string): boolean {
  return orderId.startsWith(LOCAL_ORDER_PREFIX);
}

export const useOrderStore = create<OrderStoreState>()(
  persist(
    (set, get) => ({
      syncQueue: [],
      enqueue: (item) => {
        const id = item.id ?? newId();
        const createdAt = item.createdAt ?? new Date().toISOString();
        const nextItem = { ...item, id, createdAt } as SyncQueueItem;
        set((state) => {
          const withoutSame = state.syncQueue.filter((queued) => {
            if (nextItem.type === "CREATE_ORDER" && queued.type === "CREATE_ORDER") {
              return !(
                queued.payload.userId === nextItem.payload.userId &&
                queued.payload.date === nextItem.payload.date
              );
            }
            if (nextItem.type === "CANCEL_ORDER" && queued.type === "CANCEL_ORDER") {
              return queued.payload.orderId !== nextItem.payload.orderId;
            }
            return true;
          });
          return { syncQueue: [...withoutSame, nextItem] };
        });
        return id;
      },
      remove: (id) => {
        set((state) => ({
          syncQueue: state.syncQueue.filter((item) => item.id !== id),
        }));
      },
      clear: () => set({ syncQueue: [] }),
      hasQueuedAction: (userId, date) => {
        return get().syncQueue.some((item) => {
          if (item.type === "CREATE_ORDER") {
            return item.payload.userId === userId && item.payload.date === date;
          }
          return item.payload.userId === userId && item.payload.date === date;
        });
      },
    }),
    {
      name: "bon-appetit-order-outbox",
      partialize: (state) => ({ syncQueue: state.syncQueue }),
    },
  ),
);
