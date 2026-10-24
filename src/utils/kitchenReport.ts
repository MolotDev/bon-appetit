import { dictionary } from "@/constants/dictionary";
import { MEAL_TYPES, dishFromRelation, type KitchenReportRow, type MenuRow } from "@/types";

export function completeKitchenReport(
  menu: MenuRow[],
  orderRows: KitchenReportRow[],
): KitchenReportRow[] {
  return MEAL_TYPES.map((mealType) => {
    const menuRow = menu.find((row) => row.meal_type === mealType);
    const dish = dishFromRelation(menuRow?.dishes);
    const stats = orderRows.filter((row) => row.meal_type === mealType);
    return {
      meal_type: mealType,
      dish_title: dish?.title ?? dictionary.reports.emptyDish,
      portions: stats.reduce((sum, row) => sum + Number(row.portions), 0),
      cancelled_portions: stats.reduce((sum, row) => sum + Number(row.cancelled_portions), 0),
    };
  });
}
