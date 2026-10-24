import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MEAL_TYPES, type MealType, type UserRole } from "@/types";
import { defaultMenuCatalogRange, defaultOrderTargetDate } from "@/utils/date";

export type DishStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type DishMealFilter = "ALL" | MealType;
export type UserRoleFilter = "ALL" | UserRole;
export type ReportTab = "kitchen" | "supply";

type AdminFiltersState = {
  dishesQuery: string;
  dishesMeal: DishMealFilter;
  dishesStatus: DishStatusFilter;
  menuFrom: string;
  menuTo: string;
  usersQuery: string;
  usersRole: UserRoleFilter;
  reportsDate: string;
  reportsTab: ReportTab;
  setDishesQuery: (value: string) => void;
  setDishesMeal: (value: DishMealFilter) => void;
  setDishesStatus: (value: DishStatusFilter) => void;
  setMenuRange: (from: string, to: string) => void;
  setUsersQuery: (value: string) => void;
  setUsersRole: (value: UserRoleFilter) => void;
  setReportsDate: (value: string) => void;
  setReportsTab: (value: ReportTab) => void;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_FILTERS: DishMealFilter[] = ["ALL", ...MEAL_TYPES];
const STATUS_FILTERS: DishStatusFilter[] = ["ALL", "ACTIVE", "INACTIVE"];
const ROLE_FILTERS: UserRoleFilter[] = ["ALL", "USER", "ADMIN"];

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

function isDishMealFilter(value: unknown): value is DishMealFilter {
  return typeof value === "string" && MEAL_FILTERS.includes(value as DishMealFilter);
}

function isDishStatusFilter(value: unknown): value is DishStatusFilter {
  return typeof value === "string" && STATUS_FILTERS.includes(value as DishStatusFilter);
}

function isUserRoleFilter(value: unknown): value is UserRoleFilter {
  return typeof value === "string" && ROLE_FILTERS.includes(value as UserRoleFilter);
}

function isReportTab(value: unknown): value is ReportTab {
  return value === "kitchen" || value === "supply";
}

const initialRange = defaultMenuCatalogRange();

export const useAdminFiltersStore = create<AdminFiltersState>()(
  persist(
    (set) => ({
      dishesQuery: "",
      dishesMeal: "ALL",
      dishesStatus: "ALL",
      menuFrom: initialRange.from,
      menuTo: initialRange.to,
      usersQuery: "",
      usersRole: "ALL",
      reportsDate: defaultOrderTargetDate(),
      reportsTab: "kitchen",
      setDishesQuery: (dishesQuery) => set({ dishesQuery }),
      setDishesMeal: (dishesMeal) => set({ dishesMeal }),
      setDishesStatus: (dishesStatus) => set({ dishesStatus }),
      setMenuRange: (menuFrom, menuTo) => set({ menuFrom, menuTo }),
      setUsersQuery: (usersQuery) => set({ usersQuery }),
      setUsersRole: (usersRole) => set({ usersRole }),
      setReportsDate: (reportsDate) => set({ reportsDate }),
      setReportsTab: (reportsTab) => set({ reportsTab }),
    }),
    {
      name: "bon-appetit-admin-filters",
      partialize: (state) => ({
        dishesQuery: state.dishesQuery,
        dishesMeal: state.dishesMeal,
        dishesStatus: state.dishesStatus,
        menuFrom: state.menuFrom,
        menuTo: state.menuTo,
        usersQuery: state.usersQuery,
        usersRole: state.usersRole,
        reportsDate: state.reportsDate,
        reportsTab: state.reportsTab,
      }),
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === "object" ? (persisted as Partial<AdminFiltersState>) : {};
        return {
          ...current,
          dishesQuery: typeof saved.dishesQuery === "string" ? saved.dishesQuery : current.dishesQuery,
          dishesMeal: isDishMealFilter(saved.dishesMeal) ? saved.dishesMeal : current.dishesMeal,
          dishesStatus: isDishStatusFilter(saved.dishesStatus) ? saved.dishesStatus : current.dishesStatus,
          menuFrom: isIsoDate(saved.menuFrom) ? saved.menuFrom : current.menuFrom,
          menuTo: isIsoDate(saved.menuTo) ? saved.menuTo : current.menuTo,
          usersQuery: typeof saved.usersQuery === "string" ? saved.usersQuery : current.usersQuery,
          usersRole: isUserRoleFilter(saved.usersRole) ? saved.usersRole : current.usersRole,
          reportsDate: isIsoDate(saved.reportsDate) ? saved.reportsDate : current.reportsDate,
          reportsTab: isReportTab(saved.reportsTab) ? saved.reportsTab : current.reportsTab,
        };
      },
    },
  ),
);
