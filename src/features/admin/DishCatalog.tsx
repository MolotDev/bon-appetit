import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import { createDish, updateDish } from "@/services/api";
import { MEAL_TYPES, type Dish, type MealType } from "@/types";
import { cn } from "@/utils/cn";

const selectClassName =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50";

type DishCatalogProps = {
  dishes: Dish[];
  status: "loading" | "empty" | "error" | "success";
  errorMessage: string;
  onReload: () => void;
};

export function DishCatalog({ dishes, status, errorMessage, onReload }: DishCatalogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [mealType, setMealType] = useState<MealType>("BREAKFAST");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(
    () =>
      MEAL_TYPES.map((type) => ({
        mealType: type,
        rows: dishes.filter((dish) => dish.meal_type === type),
      })),
    [dishes],
  );

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setMealType("BREAKFAST");
    setDescription("");
  }

  function startEdit(dish: Dish) {
    setEditingId(dish.id);
    setTitle(dish.title);
    setMealType(dish.meal_type);
    setDescription(dish.description);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (nextTitle.length === 0) {
      toast.error(dictionary.menu.titleRequired);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateDish(editingId, {
          title: nextTitle,
          meal_type: mealType,
          description: description.trim(),
        });
        toast.success(dictionary.menu.dishUpdated);
      } else {
        await createDish({
          title: nextTitle,
          meal_type: mealType,
          description: description.trim(),
          is_active: true,
        });
        toast.success(dictionary.menu.dishSaved);
      }
      resetForm();
      onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(dish: Dish) {
    setSaving(true);
    try {
      await updateDish(dish.id, { is_active: !dish.is_active });
      onReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{dictionary.menu.catalogTitle}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? dictionary.menu.editDish : dictionary.menu.addDish}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-title">{dictionary.menu.title}</Label>
              <Input
                id="dish-title"
                className="h-11"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-category">{dictionary.menu.category}</Label>
              <select
                id="dish-category"
                className={selectClassName}
                value={mealType}
                onChange={(event) => setMealType(event.target.value as MealType)}
              >
                {MEAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {dictionary.mealType[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-description">{dictionary.menu.description}</Label>
              <textarea
                id="dish-description"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="h-11" disabled={saving}>
                {dictionary.common.save}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" className="h-11" onClick={resetForm}>
                  {dictionary.common.cancel}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <ScreenState
        status={status}
        emptyMessage={dictionary.menu.dishesEmpty}
        errorMessage={errorMessage}
        onRetry={onReload}
      >
        <div className="flex flex-col gap-4">
          {grouped.map((group) =>
            group.rows.length === 0 ? null : (
              <div key={group.mealType} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {dictionary.mealType[group.mealType]}
                </h3>
                {group.rows.map((dish) => (
                  <Card key={dish.id} className={cn(!dish.is_active && "opacity-70")}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{dish.title}</p>
                        {dish.description ? (
                          <p className="text-sm text-muted-foreground">{dish.description}</p>
                        ) : null}
                        {!dish.is_active ? (
                          <p className="text-xs text-muted-foreground">{dictionary.menu.inactive}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={saving}
                          onClick={() => startEdit(dish)}
                        >
                          {dictionary.common.edit}
                        </Button>
                        <Button
                          type="button"
                          variant={dish.is_active ? "secondary" : "default"}
                          className="h-11"
                          disabled={saving}
                          onClick={() => void onToggleActive(dish)}
                        >
                          {dish.is_active ? dictionary.menu.deactivate : dictionary.menu.activate}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ),
          )}
        </div>
      </ScreenState>
    </section>
  );
}
