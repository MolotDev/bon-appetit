import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeadlineBanner } from "@/components/shared/DeadlineBanner";
import { DashboardPage } from "@/components/shared/DashboardPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import {
  checkAdminMenuDeadline,
  deleteDailyMenuRows,
  getDailyMenu,
  getDailyMenusInRange,
  insertDailyMenuRows,
  listDishes,
} from "@/services/api";
import { MEAL_TYPES, dishFromRelation, type Dish, type MealType, type MenuRow } from "@/types";
import { cn } from "@/utils/cn";
import {
  defaultMenuCatalogRange,
  defaultOrderTargetDate,
  eachIsoDateInRange,
  formatDateUk,
  formatWeekdayUk,
  isAdminMenuDeadlineOpen,
  todayKyivIsoDate,
} from "@/utils/date";

function groupRowsByDate(rows: MenuRow[]): Map<string, MenuRow[]> {
  const grouped = new Map<string, MenuRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.date) ?? [];
    current.push(row);
    grouped.set(row.date, current);
  }
  return grouped;
}

export function DailyMenuBuilder() {
  const today = todayKyivIsoDate();
  const defaultRange = defaultMenuCatalogRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [menusByDate, setMenusByDate] = useState<Map<string, MenuRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState(false);
  const [selected, setSelected] = useState<Partial<Record<MealType, string>>>({});
  const [deadlineOpen, setDeadlineOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const editorDateRef = useRef<string | null>(null);

  const dates = useMemo(() => eachIsoDateInRange(from, to), [from, to]);

  const selectedIds = useMemo(
    () => new Set(Object.values(selected).filter((id): id is string => Boolean(id))),
    [selected],
  );

  const activeDishes = useMemo(
    () => dishes.filter((dish) => dish.is_active || selectedIds.has(dish.id)),
    [dishes, selectedIds],
  );

  async function loadRange(rangeFrom: string, rangeTo: string) {
    if (rangeFrom > rangeTo) {
      setErrorMessage(dictionary.menu.rangeInvalid);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const [dishRows, menuRows] = await Promise.all([
        listDishes(),
        getDailyMenusInRange(rangeFrom, rangeTo),
      ]);
      setDishes(dishRows);
      setMenusByDate(groupRowsByDate(menuRows as MenuRow[]));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRange(from, to);
  }, [from, to]);

  function resetRange() {
    const range = defaultMenuCatalogRange();
    setFrom(range.from);
    setTo(range.to);
  }

  function applyEditorDate(date: string, rows: MenuRow[]) {
    editorDateRef.current = date;
    setEditorDate(date);
    const nextSelected: Partial<Record<MealType, string>> = {};
    for (const row of rows) {
      if (!nextSelected[row.meal_type]) {
        nextSelected[row.meal_type] = row.dish_id;
      }
    }
    setSelected(nextSelected);
    setDeadlineOpen(isAdminMenuDeadlineOpen(date));
  }

  function openEditor(date: string) {
    setDateLocked(true);
    applyEditorDate(date, menusByDate.get(date) ?? []);
  }

  function openCreate() {
    const date = defaultOrderTargetDate();
    setDateLocked(false);
    applyEditorDate(date, menusByDate.get(date) ?? []);
    if (!menusByDate.has(date)) {
      void loadDay(date);
    }
  }

  async function loadDay(date: string) {
    try {
      const rows = (await getDailyMenu(date)) as MenuRow[];
      setMenusByDate((current) => {
        const next = new Map(current);
        next.set(date, rows);
        return next;
      });
      if (editorDateRef.current === date) {
        applyEditorDate(date, rows);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    }
  }

  function onCreateDateChange(date: string) {
    const next = date.length > 0 ? date : defaultOrderTargetDate();
    applyEditorDate(next, menusByDate.get(next) ?? []);
    if (!menusByDate.has(next)) {
      void loadDay(next);
    }
  }

  function closeEditor() {
    editorDateRef.current = null;
    setEditorDate(null);
    setDateLocked(false);
    setSelected({});
  }

  function selectDish(mealType: MealType, dishId: string) {
    if (!deadlineOpen) {
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (dishId.length === 0) {
        delete next[mealType];
      } else {
        next[mealType] = dishId;
      }
      return next;
    });
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorDate) {
      return;
    }
    if (!deadlineOpen) {
      toast.error(dictionary.menu.deadlineClosed);
      return;
    }
    setSaving(true);
    try {
      const allowed = await checkAdminMenuDeadline(editorDate);
      if (!allowed) {
        setDeadlineOpen(false);
        toast.error(dictionary.menu.deadlineClosed);
        return;
      }
      const menu = menusByDate.get(editorDate) ?? [];
      const toRemove = menu.filter((row) => !selectedIds.has(row.dish_id)).map((row) => row.id);
      const existingDishIds = new Set(menu.map((row) => row.dish_id));
      const toAdd = [...selectedIds]
        .filter((dishId) => !existingDishIds.has(dishId))
        .map((dishId) => {
          const dish = dishes.find((item) => item.id === dishId);
          if (!dish) {
            return null;
          }
          return { date: editorDate, dish_id: dish.id, meal_type: dish.meal_type };
        })
        .filter((row): row is { date: string; dish_id: string; meal_type: Dish["meal_type"] } =>
          Boolean(row),
        );

      await deleteDailyMenuRows(toRemove);
      await insertDailyMenuRows(toAdd);
      toast.success(dictionary.menu.menuSaved);
      const nextFrom = editorDate < from ? editorDate : from;
      const nextTo = editorDate > to ? editorDate : to;
      closeEditor();
      if (nextFrom !== from) {
        setFrom(nextFrom);
      }
      if (nextTo !== to) {
        setTo(nextTo);
      }
      await loadRange(nextFrom, nextTo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DashboardPage
        title={dictionary.screens.adminMenu}
        toolbar={
          <>
            <Input
              type="date"
              className="h-10 w-40 shrink-0"
              value={from}
              onChange={(event) => setFrom(event.target.value || defaultRange.from)}
              aria-label={dictionary.menu.dateFrom}
            />
            <Input
              type="date"
              className="h-10 w-40 shrink-0"
              value={to}
              onChange={(event) => setTo(event.target.value || defaultRange.to)}
              aria-label={dictionary.menu.dateTo}
            />
            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={resetRange}>
              {dictionary.menu.fiveDays}
            </Button>
            <Button type="button" className="ml-auto h-10 shrink-0" onClick={openCreate}>
              {dictionary.menu.createMenu}
            </Button>
          </>
        }
      >
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{dictionary.common.loading}</p>
          ) : errorMessage ? (
            <div className="flex flex-nowrap items-center gap-2">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRange(from, to)}>
                {dictionary.common.retry}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {dates.map((date) => {
                const rows = menusByDate.get(date) ?? [];
                const isToday = date === today;
                const open = isAdminMenuDeadlineOpen(date);
                return (
                  <Card
                    key={date}
                    className={cn("flex flex-col", isToday && "border-primary ring-2 ring-primary/30")}
                  >
                    <CardHeader className="space-y-1 p-4 pb-2">
                      <p className="text-xs capitalize text-muted-foreground">{formatWeekdayUk(date)}</p>
                      <CardTitle className="text-base">{formatDateUk(date)}</CardTitle>
                      {isToday ? (
                        <p className="text-xs font-medium text-primary">{dictionary.menu.today}</p>
                      ) : null}
                      {!open ? (
                        <p className="text-xs text-muted-foreground">{dictionary.menu.locked}</p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
                      {rows.length === 0 ? (
                        <p className="flex-1 text-sm text-muted-foreground">{dictionary.menu.empty}</p>
                      ) : (
                        <div className="flex flex-1 flex-col gap-3">
                          {MEAL_TYPES.map((mealType) => {
                            const items = rows.filter((row) => row.meal_type === mealType);
                            if (items.length === 0) {
                              return null;
                            }
                            return (
                              <div key={mealType}>
                                <p className="text-xs font-medium text-muted-foreground">
                                  {dictionary.mealType[mealType]}
                                </p>
                                <ul className="mt-1 space-y-1 text-sm">
                                  {items.map((row) => {
                                    const dish = dishFromRelation(row.dishes);
                                    return (
                                      <li key={row.id}>{dish?.title ?? dictionary.menu.title}</li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {open ? (
                        <Button
                          type="button"
                          variant={rows.length === 0 ? "default" : "outline"}
                          className="mt-auto h-10"
                          onClick={() => openEditor(date)}
                        >
                          {rows.length === 0 ? dictionary.menu.fillMenu : dictionary.menu.editMenu}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DashboardPage>

      <Dialog
        open={editorDate !== null}
        title={dateLocked ? dictionary.menu.editMenu : dictionary.menu.createMenu}
        wide
        onClose={closeEditor}
      >
        {editorDate ? (
          <form className="flex flex-col gap-4" onSubmit={(event) => void onSave(event)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="menu-editor-date">{dictionary.common.date}</Label>
              <Input
                id="menu-editor-date"
                type="date"
                className="h-10"
                value={editorDate}
                disabled={dateLocked}
                onChange={(event) => onCreateDateChange(event.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{dictionary.menu.deadlineWarning}</p>
            {!deadlineOpen ? <DeadlineBanner message={dictionary.menu.deadlineClosed} /> : null}
            {MEAL_TYPES.map((mealType) => {
              const options = activeDishes.filter((dish) => dish.meal_type === mealType);
              return (
                <div key={mealType} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{dictionary.mealType[mealType]}</p>
                  {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{dictionary.menu.dishesEmpty}</p>
                  ) : (
                    <>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="radio"
                          className="h-4 w-4 accent-primary"
                          name={`menu-${editorDate}-${mealType}`}
                          checked={!selected[mealType]}
                          disabled={!deadlineOpen || saving}
                          onChange={() => selectDish(mealType, "")}
                        />
                        <span>{dictionary.order.none}</span>
                      </label>
                      {options.map((dish) => (
                        <label key={dish.id} className="flex min-h-11 items-start gap-3 text-sm">
                          <input
                            type="radio"
                            className="mt-1 h-4 w-4 accent-primary"
                            name={`menu-${editorDate}-${mealType}`}
                            checked={selected[mealType] === dish.id}
                            disabled={!deadlineOpen || saving}
                            onChange={() => selectDish(mealType, dish.id)}
                          />
                          <span>
                            <span className="font-medium">{dish.title}</span>
                            {dish.description ? (
                              <span className="block text-muted-foreground">{dish.description}</span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
            <p className="text-sm text-muted-foreground">{dictionary.menu.onePerMealType}</p>
            <p className="text-sm text-muted-foreground">
              {dictionary.menu.selected}: {selectedIds.size}
            </p>
            <Button type="submit" className="h-10" disabled={!deadlineOpen || saving}>
              {dictionary.menu.saveMenu}
            </Button>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
