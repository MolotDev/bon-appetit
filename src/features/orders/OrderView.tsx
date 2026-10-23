import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeadlineBanner } from "@/components/shared/DeadlineBanner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import {
  checkUserOrderDeadline,
  createOrder,
  getDailyMenu,
  getOwnOrderForDate,
  listLocations,
  replaceOrderItems,
  updateOrder,
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  MEAL_TYPES,
  dishFromRelation,
  type Location,
  type MealType,
  type MenuRow,
  type OrderWithItems,
} from "@/types";
import { defaultOrderTargetDate, isUserOrderDeadlineOpen, todayKyivIsoDate } from "@/utils/date";

const selectClassName =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export function OrderView() {
  const profile = useAuthStore((state) => state.profile);
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

  async function load(date: string) {
    if (!profile) {
      return;
    }
    setStatus("loading");
    try {
      const [locationRows, menuRows, existing, allowed] = await Promise.all([
        listLocations(),
        getDailyMenu(date),
        getOwnOrderForDate(profile.id, date),
        checkUserOrderDeadline(date),
      ]);
      const typedMenu = menuRows as MenuRow[];
      setLocations(locationRows);
      setMenu(typedMenu);
      setDeadlineOpen(allowed && isUserOrderDeadlineOpen(date));
      setOrder(existing);

      const defaultLocation =
        existing?.target_location_id ??
        profile.default_location_id ??
        locationRows[0]?.id ??
        "";
      setLocationId(defaultLocation);

      const nextSelected: Partial<Record<MealType, string>> = {};
      for (const item of existing?.order_items ?? []) {
        const row = typedMenu.find((entry) => entry.id === item.daily_menu_id);
        if (row) {
          nextSelected[row.meal_type] = row.id;
        }
      }
      setSelected(nextSelected);

      if (locationRows.length === 0) {
        setStatus("empty");
        return;
      }
      setStatus("success");
    } catch (error) {
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
  const canEdit = deadlineOpen && status === "success" && locations.length > 0;

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
      const allowed = await checkUserOrderDeadline(targetDate);
      if (!allowed) {
        setDeadlineOpen(false);
        toast.error(dictionary.order.deadlineClosed);
        return;
      }
      let orderId = order?.id;
      if (!orderId) {
        const created = await createOrder({
          user_id: profile.id,
          target_location_id: locationId,
          date: targetDate,
          status: "PENDING",
        });
        orderId = created.id;
      } else {
        await updateOrder(orderId, {
          target_location_id: locationId,
          status: "PENDING",
        });
      }
      await replaceOrderItems(orderId, dailyMenuIds);
      const refreshed = await getOwnOrderForDate(profile.id, targetDate);
      setOrder(refreshed);
      toast.success(dictionary.order.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{dictionary.screens.order}</h1>
        {order ? <StatusBadge status={order.status} /> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="order-date">{dictionary.common.date}</Label>
        <Input
          id="order-date"
          type="date"
          className="h-11"
          min={todayKyivIsoDate()}
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value || defaultOrderTargetDate())}
        />
      </div>

      {!deadlineOpen ? <DeadlineBanner message={dictionary.order.deadlineClosed} /> : null}

      <ScreenState
        status={status === "success" && locations.length === 0 ? "empty" : status}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        onRetry={() => void load(targetDate)}
      >
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <fieldset disabled={!canEdit || submitting} className="flex flex-col gap-5 disabled:opacity-100">
            <div className="flex flex-col gap-2">
              <Label htmlFor="location">{dictionary.order.location}</Label>
              <select
                id="location"
                className={selectClassName}
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">{dictionary.order.selectLocation}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            {menu.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {dictionary.order.emptyMenu}
              </p>
            ) : (
              grouped.map((group) => (
                <Card key={group.mealType}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">{dictionary.mealType[group.mealType]}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 p-4 pt-2">
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name={group.mealType}
                        className="h-4 w-4 accent-primary"
                        checked={!selected[group.mealType]}
                        onChange={() =>
                          setSelected((current) => {
                            const next = { ...current };
                            delete next[group.mealType];
                            return next;
                          })
                        }
                      />
                      {dictionary.order.none}
                    </label>
                    {group.rows.map((row) => {
                      const dish = dishFromRelation(row.dishes);
                      if (!dish) {
                        return null;
                      }
                      return (
                        <label key={row.id} className="flex min-h-11 items-start gap-3 text-sm">
                          <input
                            type="radio"
                            name={group.mealType}
                            className="mt-1 h-4 w-4 accent-primary"
                            checked={selected[group.mealType] === row.id}
                            onChange={() =>
                              setSelected((current) => ({ ...current, [group.mealType]: row.id }))
                            }
                          />
                          <span>
                            <span className="font-medium">{dish.title}</span>
                            {dish.description ? (
                              <span className="block text-muted-foreground">{dish.description}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </fieldset>
          <Button type="submit" className="h-12" disabled={!canEdit || submitting || menu.length === 0}>
            {dictionary.order.save}
          </Button>
        </form>
      </ScreenState>
    </section>
  );
}
