import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeadlineBanner } from "@/components/shared/DeadlineBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import {
  checkAdminMenuDeadline,
  deleteDailyMenuRows,
  getDailyMenu,
  insertDailyMenuRows,
} from "@/services/api";
import { MEAL_TYPES, type Dish, type MenuRow } from "@/types";
import { isAdminMenuDeadlineOpen } from "@/utils/date";

type DailyMenuBuilderProps = {
  dishes: Dish[];
  date: string;
  onDateChange: (date: string) => void;
};

export function DailyMenuBuilder({ dishes, date, onDateChange }: DailyMenuBuilderProps) {
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deadlineOpen, setDeadlineOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeDishes = useMemo(
    () => dishes.filter((dish) => dish.is_active || selected.has(dish.id)),
    [dishes, selected],
  );

  async function load(targetDate: string) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [rows, allowed] = await Promise.all([
        getDailyMenu(targetDate),
        checkAdminMenuDeadline(targetDate),
      ]);
      const typed = rows as MenuRow[];
      setMenu(typed);
      setSelected(new Set(typed.map((row) => row.dish_id)));
      setDeadlineOpen(allowed && isAdminMenuDeadlineOpen(targetDate));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(date);
  }, [date]);

  function toggleDish(dishId: string) {
    if (!deadlineOpen) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(dishId)) {
        next.delete(dishId);
      } else {
        next.add(dishId);
      }
      return next;
    });
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deadlineOpen) {
      toast.error(dictionary.menu.deadlineClosed);
      return;
    }
    setSaving(true);
    try {
      const allowed = await checkAdminMenuDeadline(date);
      if (!allowed) {
        setDeadlineOpen(false);
        toast.error(dictionary.menu.deadlineClosed);
        return;
      }
      const toRemove = menu.filter((row) => !selected.has(row.dish_id)).map((row) => row.id);
      const existingDishIds = new Set(menu.map((row) => row.dish_id));
      const toAdd = [...selected]
        .filter((dishId) => !existingDishIds.has(dishId))
        .map((dishId) => {
          const dish = dishes.find((item) => item.id === dishId);
          if (!dish) {
            return null;
          }
          return { date, dish_id: dish.id, meal_type: dish.meal_type };
        })
        .filter((row): row is { date: string; dish_id: string; meal_type: Dish["meal_type"] } =>
          Boolean(row),
        );

      await deleteDailyMenuRows(toRemove);
      await insertDailyMenuRows(toAdd);
      toast.success(dictionary.menu.menuSaved);
      await load(date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{dictionary.menu.dailyTitle}</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="menu-date">{dictionary.common.date}</Label>
        <Input
          id="menu-date"
          type="date"
          className="h-11"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>
      <p className="text-sm text-muted-foreground">{dictionary.menu.deadlineWarning}</p>
      {!deadlineOpen ? <DeadlineBanner message={dictionary.menu.deadlineClosed} /> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{dictionary.common.loading}</p>
      ) : errorMessage ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button type="button" variant="outline" onClick={() => void load(date)}>
            {dictionary.common.retry}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSave}>
          {MEAL_TYPES.map((mealType) => {
            const options = activeDishes.filter((dish) => dish.meal_type === mealType);
            return (
              <Card key={mealType}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{dictionary.mealType[mealType]}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 p-4 pt-2">
                  {options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{dictionary.menu.dishesEmpty}</p>
                  ) : (
                    options.map((dish) => (
                      <label key={dish.id} className="flex min-h-11 items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-primary"
                          checked={selected.has(dish.id)}
                          disabled={!deadlineOpen || saving}
                          onChange={() => toggleDish(dish.id)}
                        />
                        <span>
                          <span className="font-medium">{dish.title}</span>
                          {dish.description ? (
                            <span className="block text-muted-foreground">{dish.description}</span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
          <p className="text-sm text-muted-foreground">
            {dictionary.menu.selected}: {selected.size}
          </p>
          <Button type="submit" className="h-11" disabled={!deadlineOpen || saving}>
            {dictionary.menu.saveMenu}
          </Button>
        </form>
      )}
    </section>
  );
}
