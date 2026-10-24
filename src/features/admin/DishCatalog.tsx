import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardPage } from "@/components/shared/DashboardPage";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ViewportSelect } from "@/components/ui/viewport-select";
import { dictionary } from "@/constants/dictionary";
import { createDish, listDishes, updateDish } from "@/services/api";
import { MEAL_TYPES, type Dish, type MealType } from "@/types";
import { cn } from "@/utils/cn";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type MealFilter = "ALL" | MealType;

export function DishCatalog() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [query, setQuery] = useState("");
  const [mealFilter, setMealFilter] = useState<MealFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [mealType, setMealType] = useState<MealType>("BREAKFAST");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      const rows = await listDishes();
      setDishes(rows);
      setStatus(rows.length === 0 ? "empty" : "success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesMeal = mealFilter === "ALL" || dish.meal_type === mealFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? dish.is_active : !dish.is_active);
      const matchesQuery =
        needle.length === 0 ||
        dish.title.toLowerCase().includes(needle) ||
        dish.description.toLowerCase().includes(needle);
      return matchesMeal && matchesStatus && matchesQuery;
    });
  }, [dishes, mealFilter, query, statusFilter]);

  const listStatus = status === "success" && filtered.length === 0 ? "empty" : status;
  const emptyMessage =
    dishes.length > 0 && filtered.length === 0
      ? dictionary.states.emptyGeneric
      : dictionary.menu.dishesEmpty;

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setMealType("BREAKFAST");
    setDescription("");
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(dish: Dish) {
    setEditingId(dish.id);
    setTitle(dish.title);
    setMealType(dish.meal_type);
    setDescription(dish.description);
    setModalOpen(true);
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
      setModalOpen(false);
      resetForm();
      await load();
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
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DashboardPage
        title={dictionary.screens.adminDishes}
        toolbar={
          <>
            <Input
              className="h-10 w-56 shrink-0"
              value={query}
              placeholder={dictionary.common.search}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ViewportSelect
              className="h-10 w-40 shrink-0"
              ariaLabel={dictionary.menu.category}
              value={mealFilter}
              onChange={(value) => setMealFilter(value as MealFilter)}
              options={[
                { value: "ALL", label: dictionary.menu.allCategories },
                ...MEAL_TYPES.map((type) => ({
                  value: type,
                  label: dictionary.mealType[type],
                })),
              ]}
            />
            <ViewportSelect
              className="h-10 w-40 shrink-0"
              ariaLabel={dictionary.menu.status}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: "ALL", label: dictionary.menu.allStatuses },
                { value: "ACTIVE", label: dictionary.menu.statusActive },
                { value: "INACTIVE", label: dictionary.menu.statusInactive },
              ]}
            />
            <Button type="button" className="ml-auto h-10 shrink-0" onClick={openCreate}>
              {dictionary.menu.addDish}
            </Button>
          </>
        }
      >
        <ScreenState
          status={listStatus}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
          onRetry={() => void load()}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-3 font-medium">{dictionary.menu.title}</th>
                  <th className="px-3 py-3 font-medium">{dictionary.menu.category}</th>
                  <th className="px-3 py-3 font-medium">{dictionary.menu.description}</th>
                  <th className="px-3 py-3 font-medium">{dictionary.menu.status}</th>
                  <th className="px-3 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((dish) => (
                  <tr key={dish.id} className={cn("border-t", !dish.is_active && "text-muted-foreground")}>
                    <td className="px-3 py-3 font-medium">{dish.title}</td>
                    <td className="px-3 py-3">{dictionary.mealType[dish.meal_type]}</td>
                    <td className="px-3 py-3">{dish.description}</td>
                    <td className="px-3 py-3">
                      {dish.is_active ? dictionary.menu.statusActive : dictionary.menu.inactive}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() => openEdit(dish)}
                        >
                          {dictionary.common.edit}
                        </Button>
                        <Button
                          type="button"
                          variant={dish.is_active ? "secondary" : "default"}
                          size="sm"
                          disabled={saving}
                          onClick={() => void onToggleActive(dish)}
                        >
                          {dish.is_active ? dictionary.menu.deactivate : dictionary.menu.activate}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScreenState>
      </DashboardPage>

      <Dialog
        open={modalOpen}
        title={editingId ? dictionary.menu.editDish : dictionary.menu.addDish}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
      >
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dish-title">{dictionary.menu.title}</Label>
            <Input id="dish-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dish-category">{dictionary.menu.category}</Label>
            <ViewportSelect
              id="dish-category"
              className="h-10"
              value={mealType}
              onChange={(value) => setMealType(value as MealType)}
              options={MEAL_TYPES.map((type) => ({
                value: type,
                label: dictionary.mealType[type],
              }))}
            />
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
          <Button type="submit" className="h-10" disabled={saving}>
            {dictionary.common.save}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
