import { toast } from "sonner";
import { dictionary } from "@/constants/dictionary";
import {
  cancelOwnOrder,
  checkUserOrderDeadline,
  createOrder,
  getOwnOrderForDate,
  replaceOrderItems,
  updateOrder,
} from "@/services/api";
import { useOrderCacheStore } from "@/stores/orderCacheStore";
import {
  isLocalOrderId,
  LOCAL_ORDER_PREFIX,
  useOrderStore,
  type CancelOrderPayload,
  type CreateOrderPayload,
  type SyncQueueItem,
} from "@/stores/orderStore";
import type { MenuRow, OrderWithItems } from "@/types";
import { isUserOrderDeadlineOpen } from "@/utils/date";
import { isNetworkError, isOrderDeadlineError } from "@/utils/network";

let syncing = false;

export function buildOptimisticOrder(input: {
  orderId: string;
  userId: string;
  date: string;
  locationId: string;
  dailyMenuIds: string[];
  menu: MenuRow[];
  createdAt?: string;
}): OrderWithItems {
  return {
    id: input.orderId,
    user_id: input.userId,
    target_location_id: input.locationId,
    date: input.date,
    status: "PENDING_SYNC",
    cooking_started_at: null,
    created_at: input.createdAt ?? new Date().toISOString(),
    order_items: input.dailyMenuIds.map((dailyMenuId) => {
      const row = input.menu.find((entry) => entry.id === dailyMenuId) ?? null;
      return {
        id: `${LOCAL_ORDER_PREFIX}item-${dailyMenuId}`,
        order_id: input.orderId,
        daily_menu_id: dailyMenuId,
        daily_menu: row,
      };
    }),
  };
}

function markDeadlineFailed(userId: string, date: string, order: OrderWithItems | null) {
  if (!order) {
    return;
  }
  const failed: OrderWithItems = { ...order, status: "SYNC_FAILED_DEADLINE" };
  useOrderCacheStore.getState().cacheOrder(userId, date, failed);
}

async function submitCreate(payload: CreateOrderPayload): Promise<OrderWithItems | null> {
  if (!isUserOrderDeadlineOpen(payload.date)) {
    throw new Error("Order deadline passed");
  }
  const allowed = await checkUserOrderDeadline(payload.date);
  if (!allowed) {
    throw new Error("Order deadline passed");
  }

  const serverId =
    payload.existingOrderId && !isLocalOrderId(payload.existingOrderId)
      ? payload.existingOrderId
      : null;

  let orderId = serverId;
  if (!orderId) {
    const created = await createOrder({
      user_id: payload.userId,
      target_location_id: payload.locationId,
      date: payload.date,
      status: "PENDING",
    });
    orderId = created.id;
  } else {
    await updateOrder(orderId, {
      target_location_id: payload.locationId,
      status: "PENDING",
    });
  }
  await replaceOrderItems(orderId, payload.dailyMenuIds);
  return getOwnOrderForDate(payload.userId, payload.date);
}

async function submitCancel(payload: CancelOrderPayload): Promise<OrderWithItems | null> {
  if (isLocalOrderId(payload.orderId)) {
    return {
      id: payload.orderId,
      user_id: payload.userId,
      target_location_id: "",
      date: payload.date,
      status: "CANCELLED",
      cooking_started_at: null,
      created_at: new Date().toISOString(),
      order_items: [],
    };
  }
  await cancelOwnOrder(payload.orderId);
  return getOwnOrderForDate(payload.userId, payload.date);
}

async function processItem(item: SyncQueueItem): Promise<void> {
  if (item.type === "CREATE_ORDER") {
    const refreshed = await submitCreate(item.payload);
    useOrderCacheStore.getState().cacheOrder(item.payload.userId, item.payload.date, refreshed);
    return;
  }

  const cached = useOrderCacheStore.getState().ordersByDate[item.payload.date] ?? null;
  if (isLocalOrderId(item.payload.orderId)) {
    useOrderStore.getState().syncQueue
      .filter(
        (queued) =>
          queued.type === "CREATE_ORDER" &&
          queued.payload.userId === item.payload.userId &&
          queued.payload.date === item.payload.date,
      )
      .forEach((queued) => useOrderStore.getState().remove(queued.id));
    if (cached) {
      useOrderCacheStore.getState().cacheOrder(item.payload.userId, item.payload.date, {
        ...cached,
        status: "CANCELLED",
      });
    }
    return;
  }

  const refreshed = await submitCancel(item.payload);
  useOrderCacheStore.getState().cacheOrder(item.payload.userId, item.payload.date, refreshed);
}

export function enqueueCreateOrder(payload: CreateOrderPayload, optimistic: OrderWithItems): void {
  useOrderStore.getState().enqueue({ type: "CREATE_ORDER", payload });
  useOrderCacheStore.getState().cacheOrder(payload.userId, payload.date, optimistic);
  toast.success(dictionary.order.savedLocally);
}

export function enqueueCancelOrder(payload: CancelOrderPayload, optimistic: OrderWithItems): void {
  if (isLocalOrderId(payload.orderId)) {
    const queue = useOrderStore.getState().syncQueue;
    for (const item of queue) {
      if (
        item.type === "CREATE_ORDER" &&
        item.payload.userId === payload.userId &&
        item.payload.date === payload.date
      ) {
        useOrderStore.getState().remove(item.id);
      }
    }
    useOrderCacheStore.getState().cacheOrder(payload.userId, payload.date, optimistic);
    toast.success(dictionary.order.cancelled);
    return;
  }
  useOrderStore.getState().enqueue({ type: "CANCEL_ORDER", payload });
  useOrderCacheStore.getState().cacheOrder(payload.userId, payload.date, optimistic);
  toast.success(dictionary.order.savedLocally);
}

export async function persistOrderOrQueue(input: {
  payload: CreateOrderPayload;
  optimistic: OrderWithItems;
}): Promise<"synced" | "queued"> {
  if (!navigator.onLine) {
    enqueueCreateOrder(input.payload, input.optimistic);
    return "queued";
  }
  try {
    const refreshed = await submitCreate(input.payload);
    useOrderCacheStore.getState().cacheOrder(input.payload.userId, input.payload.date, refreshed);
    toast.success(dictionary.order.saved);
    return "synced";
  } catch (error) {
    if (isOrderDeadlineError(error) || !isUserOrderDeadlineOpen(input.payload.date)) {
      markDeadlineFailed(input.payload.userId, input.payload.date, input.optimistic);
      toast.error(dictionary.status.SYNC_FAILED_DEADLINE);
      return "queued";
    }
    if (isNetworkError(error)) {
      enqueueCreateOrder(input.payload, input.optimistic);
      return "queued";
    }
    throw error;
  }
}

export async function persistCancelOrQueue(input: {
  payload: CancelOrderPayload;
  optimistic: OrderWithItems;
}): Promise<"synced" | "queued"> {
  if (!navigator.onLine) {
    enqueueCancelOrder(input.payload, input.optimistic);
    return "queued";
  }
  try {
    if (isLocalOrderId(input.payload.orderId)) {
      enqueueCancelOrder(input.payload, input.optimistic);
      return "queued";
    }
    const refreshed = await submitCancel(input.payload);
    useOrderCacheStore.getState().cacheOrder(input.payload.userId, input.payload.date, refreshed);
    toast.success(dictionary.order.cancelled);
    return "synced";
  } catch (error) {
    if (isOrderDeadlineError(error)) {
      markDeadlineFailed(input.payload.userId, input.payload.date, input.optimistic);
      toast.error(dictionary.status.SYNC_FAILED_DEADLINE);
      return "queued";
    }
    if (isNetworkError(error)) {
      enqueueCancelOrder(input.payload, input.optimistic);
      return "queued";
    }
    throw error;
  }
}

export async function processOrderSyncQueue(): Promise<void> {
  if (syncing || !navigator.onLine) {
    return;
  }
  syncing = true;
  try {
    const items = [...useOrderStore.getState().syncQueue];
    for (const item of items) {
      try {
        await processItem(item);
        useOrderStore.getState().remove(item.id);
        toast.success(dictionary.order.synced);
      } catch (error) {
        const date = item.payload.date;
        const userId = item.payload.userId;
        const cached = useOrderCacheStore.getState().ordersByDate[date] ?? null;
        if (isOrderDeadlineError(error) || !isUserOrderDeadlineOpen(date)) {
          markDeadlineFailed(userId, date, cached);
          useOrderStore.getState().remove(item.id);
          toast.error(dictionary.status.SYNC_FAILED_DEADLINE);
          continue;
        }
        if (isNetworkError(error)) {
          break;
        }
        toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
        break;
      }
    }
  } finally {
    syncing = false;
  }
}
