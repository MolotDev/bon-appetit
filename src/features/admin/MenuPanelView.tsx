import { useCallback, useEffect, useState } from "react";
import { DailyMenuBuilder } from "@/features/admin/DailyMenuBuilder";
import { DishCatalog } from "@/features/admin/DishCatalog";
import { dictionary } from "@/constants/dictionary";
import { listDishes } from "@/services/api";
import type { Dish } from "@/types";
import { defaultOrderTargetDate } from "@/utils/date";

export function MenuPanelView() {
  const [date, setDate] = useState(defaultOrderTargetDate);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);

  const loadDishes = useCallback(async () => {
    setStatus("loading");
    try {
      const rows = await listDishes();
      setDishes(rows);
      setStatus(rows.length === 0 ? "empty" : "success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadDishes();
  }, [loadDishes]);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{dictionary.screens.adminMenu}</h1>
      <DishCatalog
        dishes={dishes}
        status={status}
        errorMessage={errorMessage}
        onReload={() => void loadDishes()}
      />
      <DailyMenuBuilder dishes={dishes} date={date} onDateChange={setDate} />
    </section>
  );
}
