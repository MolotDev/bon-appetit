import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeadlineBanner } from "@/components/shared/DeadlineBanner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { ViewportSelect } from "@/components/ui/viewport-select";
import { dictionary } from "@/constants/dictionary";
import {
  checkUserOrderDeadline,
  confirmOrderReceived,
  getDailyMenu,
  getOwnOrderForDate,
  listLocations,
} from "@/services/api";
import { buildOptimisticOrder, persistCancelOrQueue, persistOrderOrQueue } from "@/services/orderSync";
import { useAuthStore } from "@/stores/authStore";
import { useOrderCacheStore } from "@/stores/orderCacheStore";
import { isLocalOrderId, LOCAL_ORDER_PREFIX, useOrderStore } from "@/stores/orderStore";
import {
  MEAL_TYPES,
  dishFromRelation,
  type Location,
  type MealType,
  type MenuRow,
  type OrderWithItems,
} from "@/types";
import { cn } from "@/utils/cn";
import { defaultOrderTargetDate, isUserOrderDeadlineOpen, todayKyivIsoDate } from "@/utils/date";

function MealChoiceRadio({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex h-fit items-center gap-2 text-sm">
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary peer-disabled:opacity-40" />
        <span className="pointer-events-none absolute h-3 w-3 rounded-full bg-primary opacity-0 peer-checked:opacity-100 peer-disabled:opacity-40" />
      </span>
      {label}
    </label>
  );
}

export function OrderView() {
  const profile = useAuthStore((state) => state.profile);
  const online = useOnlineStatus();
  const [targetDate, setTargetDate] = useState(defaultOrderTargetDate);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [locations, setLocations] = useState<Location[]>([]);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [locationId, setLocationId] = useState("");
  const [selected, setSelected] = useState<Partial<Record<MealType, string>>>({});
  const [deadlineOpen, setDeadlineOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const cachedOrder = useOrderCacheStore((state) => {
    if (!profile || state.userId !== profile.id) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(state.ordersByDate, targetDate)) {
      return undefined;
    }
    return state.ordersByDate[targetDate] ?? null;
  });

  useEffect(() => {
    if (cachedOrder !== undefined) {
      setOrder(cachedOrder);
    }
  }, [cachedOrder]);

  function applySnapshot(
    date: string,
    locationRows: Location[],
    typedMenu: MenuRow[],
    existing: OrderWithItems | null,
    allowed: boolean,
  ) {
    setLocations(locationRows);
    setMenu(typedMenu);
    setDeadlineOpen(allowed && isUserOrderDeadlineOpen(date));
    setOrder(existing);

    const defaultLocation =
      existing?.target_location_id ??
      profile?.default_location_id ??
      locationRows[0]?.id ??
      "";
    setLocationId(defaultLocation);

    const nextSelected: Partial<Record<MealType, string>> = {};
    const existingItems = existing?.order_items ?? [];
    if (existingItems.length > 0) {
      for (const item of existingItems) {
        const row = typedMenu.find((entry) => entry.id === item.daily_menu_id);
        if (row) {
          nextSelected[row.meal_type] = row.id;
        }
      }
    } else {
      for (const mealType of MEAL_TYPES) {
        const first = typedMenu.find((row) => row.meal_type === mealType);
        if (first) {
          nextSelected[mealType] = first.id;
        }
      }
    }
    setSelected(nextSelected);

    if (locationRows.length === 0) {
      setStatus("empty");
      return;
    }
    setStatus("success");
  }

  async function load(date: string) {
    if (!profile) {
      return;
    }
    const cache = useOrderCacheStore.getState();
    const cachedForUser = cache.userId === profile.id;
    const cachedMenu = cachedForUser ? cache.menusByDate[date] : undefined;
    const cachedLocations = cachedForUser ? cache.locations : [];
    const hasCachedOrder = cachedForUser && Object.prototype.hasOwnProperty.call(cache.ordersByDate, date);
    const cachedOrder = hasCachedOrder ? (cache.ordersByDate[date] ?? null) : null;
    const hasCache = Boolean(cachedMenu) || cachedLocations.length > 0 || hasCachedOrder;

    if (hasCache) {
      applySnapshot(
        date,
        cachedLocations,
        cachedMenu ?? [],
        cachedOrder,
        isUserOrderDeadlineOpen(date),
      );
    } else {
      setStatus("loading");
    }

    try {
      const [locationRows, menuRows, existing] = await Promise.all([
        listLocations(),
        getDailyMenu(date),
        getOwnOrderForDate(profile.id, date),
      ]);
      const typedMenu = menuRows as MenuRow[];
      let allowed = isUserOrderDeadlineOpen(date);
      try {
        allowed = (await checkUserOrderDeadline(date)) && allowed;
      } catch {
        allowed = isUserOrderDeadlineOpen(date);
      }
      cache.cacheLocations(profile.id, locationRows);
      cache.cacheMenu(profile.id, date, typedMenu);
      const keepLocal = useOrderStore.getState().hasQueuedAction(profile.id, date);
      const localOrder = keepLocal ? (cache.ordersByDate[date] ?? existing) : existing;
      applySnapshot(date, locationRows, typedMenu, localOrder, allowed);
      if (!keepLocal) {
        cache.cacheOrder(profile.id, date, existing);
      }
    } catch (error) {
      if (hasCache) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void load(targetDate);
  }, [profile?.id, targetDate]);

  const grouped = useMemo(() => {
    return MEAL_TYPES.map((mealType) => ({
      mealType,
      rows: menu.filter((row) => row.meal_type === mealType),
    }));
  }, [menu]);

  const emptyMessage =
    locations.length === 0 ? dictionary.order.emptyLocations : dictionary.order.emptyMenu;
  const cookingStarted = Boolean(
    order &&
      (order.cooking_started_at || order.status === "COOKING" || order.status === "IN_DELIVERY"),
  );
  const canConfirmReceipt =
    order?.status === "COOKING" || order?.status === "IN_DELIVERY";
  const canEdit =
    deadlineOpen &&
    status === "success" &&
    locations.length > 0 &&
    !cookingStarted &&
    order?.status !== "COMPLETED" &&
    order?.status !== "SYNC_FAILED_DEADLINE";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !canEdit) {
      toast.error(dictionary.order.deadlineClosed);
      return;
    }
    if (!locationId) {
      toast.error(dictionary.order.selectLocation);
      return;
    }
    if (menu.length === 0) {
      toast.error(dictionary.order.emptyMenu);
      return;
    }
    const dailyMenuIds = MEAL_TYPES.map((mealType) => selected[mealType]).filter(
      (id): id is string => Boolean(id),
    );
    if (dailyMenuIds.length === 0) {
      toast.error(dictionary.order.atLeastOneDish);
      return;
    }

    setSubmitting(true);
    try {
      const orderId = order?.id ?? `${LOCAL_ORDER_PREFIX}${crypto.randomUUID()}`;
      const optimistic = buildOptimisticOrder({
        orderId,
        userId: profile.id,
        date: targetDate,
        locationId,
        dailyMenuIds,
        menu,
        createdAt: order?.created_at,
      });
      await persistOrderOrQueue({
        payload: {
          userId: profile.id,
          date: targetDate,
          locationId,
          dailyMenuIds,
          existingOrderId: order?.id && !isLocalOrderId(order.id) ? order.id : null,
        },
        optimistic,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancelOrder() {
    if (!profile || !order || !canConfirmReceipt) {
      return;
    }
    if (!window.confirm(dictionary.history.confirmCancel)) {
      return;
    }
    setSubmitting(true);
    try {
      await persistCancelOrQueue({
        payload: {
          userId: profile.id,
          date: targetDate,
          orderId: order.id,
        },
        optimistic: { ...order, status: "CANCELLED" },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirmReceived() {
    if (!online) {
      toast.error(dictionary.order.offlineBlocked);
      return;
    }
    if (!profile || !order || !canConfirmReceipt) {
      return;
    }
    setSubmitting(true);
    try {
      await confirmOrderReceived(order.id);
      const refreshed = await getOwnOrderForDate(profile.id, targetDate);
      setOrder(refreshed);
      useOrderCacheStore.getState().cacheOrder(profile.id, targetDate, refreshed);
      toast.success(dictionary.order.received);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{dictionary.screens.order}</h1>
        {order ? <StatusBadge status={order.status} /> : null}
      </div>

      {order?.status === "SYNC_FAILED_DEADLINE" ? (
        <DeadlineBanner message={dictionary.status.SYNC_FAILED_DEADLINE} />
      ) : cookingStarted && order?.status !== "COMPLETED" ? (
        <DeadlineBanner message={dictionary.order.cookingLocked} />
      ) : !deadlineOpen ? (
        <DeadlineBanner message={dictionary.order.deadlineClosed} />
      ) : null}

      <ScreenState
        status={status === "success" && locations.length === 0 ? "empty" : status}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        onRetry={() => void load(targetDate)}
      >
        <form className="flex min-h-0 flex-1 flex-col gap-2" onSubmit={onSubmit}>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="min-w-0">
              <Label htmlFor="order-date" className="text-xs">
                {dictionary.common.date}
              </Label>
              <DatePicker
                id="order-date"
                className="h-9"
                min={todayKyivIsoDate()}
                value={targetDate}
                onChange={(next) => setTargetDate(next || defaultOrderTargetDate())}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="location" className="text-xs">
                {dictionary.order.location}
              </Label>
              <ViewportSelect
                id="location"
                value={locationId}
                placeholder={dictionary.order.selectLocation}
                disabled={!canEdit || submitting}
                onChange={setLocationId}
                options={locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
              />
            </div>
          </div>
          <fieldset
            disabled={!canEdit || submitting}
            className="flex min-h-0 flex-1 flex-col gap-2 disabled:opacity-100"
          >

            {menu.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {dictionary.order.emptyMenu}
              </p>
            ) : (
              <div className="flex-1 flex min-h-0 flex-col gap-2 justify-between">
                {grouped.map((group) => {
                  const dishRow = group.rows.find((row) => row.id === selected[group.mealType]) ?? group.rows[0];
                  const dish = dishFromRelation(dishRow?.dishes);
                  const ordered = Boolean(selected[group.mealType]);
                  const canOrder = Boolean(dishRow);

                  function setOrdered(nextOrdered: boolean) {
                    if (!dishRow) {
                      return;
                    }
                    setSelected((current) => {
                      const next = { ...current };
                      if (nextOrdered) {
                        next[group.mealType] = dishRow.id;
                      } else {
                        delete next[group.mealType];
                      }
                      return next;
                    });
                  }

                  return (
                    <article
                      key={group.mealType}
                      className={cn(
                        "flex min-h-0 flex-1 flex-col rounded-lg border px-3 py-2",
                        ordered ? "border-primary bg-accent" : "bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="min-w-0 flex-1 text-sm font-semibold">
                          {dictionary.mealType[group.mealType]}
                        </h2>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col justify-center pl-[20%]">
                        {dish ? (
                          <>
                            <p className="text-sm font-medium leading-tight">{dish.title}</p>
                            {dish.description ? (
                              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                                {dish.description}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">{dictionary.order.emptyMenu}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <MealChoiceRadio
                          checked={canOrder && ordered}
                          disabled={!canOrder}
                          label="" //{dictionary.order.orderDish}
                          onChange={setOrdered}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </fieldset>
          {canConfirmReceipt ? (
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 flex-1"
                disabled={submitting}
                onClick={() => void onCancelOrder()}
              >
                {dictionary.order.cancelOrder}
              </Button>
              <Button
                type="button"
                className="h-11 flex-1"
                disabled={submitting || !online}
                title={!online ? dictionary.order.offlineBlocked : undefined}
                onClick={() => void onConfirmReceived()}
              >
                {dictionary.order.confirmReceived}
              </Button>
            </div>
          ) : cookingStarted || order?.status === "COMPLETED" ? null : (
            <Button
              type="submit"
              className="h-11 shrink-0"
              disabled={!canEdit || submitting || menu.length === 0}
            >
              {dictionary.order.save}
            </Button>
          )}
        </form>
      </ScreenState>
    </section>
  );
}
