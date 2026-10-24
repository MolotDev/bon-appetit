import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Location, MenuRow, OrderWithItems } from "@/types";

type OrderCacheState = {
  userId: string | null;
  locations: Location[];
  menusByDate: Record<string, MenuRow[]>;
  ordersByDate: Record<string, OrderWithItems | null>;
  history: OrderWithItems[];
  cacheLocations: (userId: string, locations: Location[]) => void;
  cacheMenu: (userId: string, date: string, menu: MenuRow[]) => void;
  cacheOrder: (userId: string, date: string, order: OrderWithItems | null) => void;
  cacheHistory: (userId: string, orders: OrderWithItems[]) => void;
  clear: () => void;
};

const emptyState = {
  userId: null as string | null,
  locations: [] as Location[],
  menusByDate: {} as Record<string, MenuRow[]>,
  ordersByDate: {} as Record<string, OrderWithItems | null>,
  history: [] as OrderWithItems[],
};

function resetIfOtherUser(
  currentUserId: string | null,
  nextUserId: string,
): Partial<OrderCacheState> {
  if (currentUserId === nextUserId) {
    return { userId: nextUserId };
  }
  return {
    userId: nextUserId,
    locations: [],
    menusByDate: {},
    ordersByDate: {},
    history: [],
  };
}

export const useOrderCacheStore = create<OrderCacheState>()(
  persist(
    (set) => ({
      ...emptyState,
      cacheLocations: (userId, locations) => {
        set((state) => ({
          ...resetIfOtherUser(state.userId, userId),
          locations,
        }));
      },
      cacheMenu: (userId, date, menu) => {
        set((state) => {
          const base = resetIfOtherUser(state.userId, userId);
          const menusByDate = { ...(base.menusByDate ?? state.menusByDate), [date]: menu };
          return { ...base, menusByDate };
        });
      },
      cacheOrder: (userId, date, order) => {
        set((state) => {
          const base = resetIfOtherUser(state.userId, userId);
          const ordersByDate = { ...(base.ordersByDate ?? state.ordersByDate), [date]: order };
          const historySource = base.history ?? state.history;
          const history = order
            ? [order, ...historySource.filter((row) => row.id !== order.id)]
            : historySource;
          return { ...base, ordersByDate, history };
        });
      },
      cacheHistory: (userId, orders) => {
        set((state) => ({
          ...resetIfOtherUser(state.userId, userId),
          history: orders,
        }));
      },
      clear: () => set(emptyState),
    }),
    { name: "bon-appetit-order-cache" },
  ),
);
