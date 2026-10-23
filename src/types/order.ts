import type { MealType, Tables } from "./database";

type DailyMenu = Tables<"daily_menu">;
type Dish = Tables<"dishes">;
type Order = Tables<"orders">;
type OrderItem = Tables<"order_items">;

export type MenuRow = DailyMenu & { dishes: Dish | Dish[] | null };

export type OrderItemWithMenu = OrderItem & {
  daily_menu: (DailyMenu & { dishes: Dish | Dish[] | null }) | null;
};

export type OrderWithItems = Order & {
  order_items: OrderItemWithMenu[] | null;
};

export const MEAL_TYPES: MealType[] = [
  "BREAKFAST",
  "LUNCH_FIRST",
  "LUNCH_SECOND",
  "DINNER",
];

export function dishFromRelation(value: Dish | Dish[] | null | undefined): Dish | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
