import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardPage } from "@/components/shared/DashboardPage";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ViewportSelect } from "@/components/ui/viewport-select";
import { dictionary } from "@/constants/dictionary";
import { OpsCheckPanel } from "@/features/admin/OpsCheckPanel";
import {
  getDeliveryReport,
  getKitchenReport,
  listOrderStatusesForDate,
  startKitchenCooking,
} from "@/services/api";
import type { DeliveryReportRow, KitchenReportRow, MealType } from "@/types";
import { cn } from "@/utils/cn";
import { defaultOrderTargetDate, formatDateUk } from "@/utils/date";
import { buildMessengerSummary, exportReportPdf } from "@/utils/reportExport";

type ReportTab = "kitchen" | "supply";

export function ReportsView() {
  const [date, setDate] = useState(defaultOrderTargetDate);
  const [tab, setTab] = useState<ReportTab>("kitchen");
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [kitchen, setKitchen] = useState<KitchenReportRow[]>([]);
  const [delivery, setDelivery] = useState<DeliveryReportRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [cookingStarted, setCookingStarted] = useState(false);
  const [startingCooking, setStartingCooking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  async function loadReports(targetDate: string) {
    setStatus("loading");
    try {
      const [kitchenRows, deliveryRows, orderStatuses] = await Promise.all([
        getKitchenReport(targetDate),
        getDeliveryReport(targetDate),
        listOrderStatusesForDate(targetDate),
      ]);
      setKitchen(kitchenRows);
      setDelivery(deliveryRows);
      setPendingCount(orderStatuses.filter((row) => row.status === "PENDING").length);
      setCookingStarted(
        orderStatuses.some(
          (row) => row.status === "COOKING" || Boolean(row.cooking_started_at),
        ),
      );
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadReports(date);
  }, [date]);

  const hasKitchen = kitchen.length > 0;
  const hasSupply = delivery.some(
    (row) =>
      row.breakfast_count +
        row.lunch_first_count +
        row.lunch_second_count +
        row.dinner_count +
        row.kits_count >
      0,
  );

  async function onStartCooking() {
    if (pendingCount === 0) {
      toast.error(dictionary.reports.nothingToCook);
      return;
    }
    if (!window.confirm(dictionary.reports.confirmStartCooking)) {
      return;
    }
    setStartingCooking(true);
    try {
      const updated = await startKitchenCooking(date);
      if (updated === 0) {
        toast.error(dictionary.reports.nothingToCook);
      } else {
        toast.success(dictionary.reports.cookingStartedToast);
      }
      await loadReports(date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setStartingCooking(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(
        buildMessengerSummary(date, kitchen, delivery),
      );
      toast.success(dictionary.reports.copied);
    } catch {
      toast.error(dictionary.states.errorGeneric);
    }
  }

  async function onPdf() {
    const node = exportRef.current;
    if (!node) {
      return;
    }
    setExporting(true);
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 50);
      });
      await exportReportPdf(node, `bon-appetit-${date}.pdf`);
    } catch {
      toast.error(dictionary.reports.pdfFailed);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DashboardPage
      title={dictionary.screens.adminReports}
      toolbar={
        <>
          <DatePicker
            id="report-date"
            className="h-10 w-44 shrink-0"
            value={date}
            ariaLabel={dictionary.common.date}
            onChange={(next) => setDate(next || defaultOrderTargetDate())}
          />
          <ViewportSelect
            className="h-10 w-44 shrink-0"
            ariaLabel={dictionary.reports.heading}
            value={tab}
            onChange={(value) => setTab(value as ReportTab)}
            options={[
              { value: "kitchen", label: dictionary.reports.kitchenTitle },
              { value: "supply", label: dictionary.reports.deliveryTitle },
            ]}
          />
          <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => window.print()}>
            {dictionary.reports.print}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            disabled={exporting}
            onClick={() => void onPdf()}
          >
            {dictionary.reports.exportPdf}
          </Button>
          {tab === "kitchen" ? (
            <Button
              type="button"
              className="h-10 shrink-0"
              disabled={startingCooking || pendingCount === 0}
              onClick={() => void onStartCooking()}
            >
              {cookingStarted && pendingCount === 0
                ? dictionary.reports.cookingStarted
                : dictionary.reports.startCooking}
            </Button>
          ) : null}
          <Button type="button" className="ml-auto h-10 shrink-0" onClick={() => void onCopy()}>
            {dictionary.reports.copySummary}
          </Button>
        </>
      }
      footer={
        <div className="print:hidden">
          <OpsCheckPanel />
        </div>
      }
    >
      <ScreenState
        status={status}
        errorMessage={errorMessage}
        onRetry={() => void loadReports(date)}
      >
        <div ref={exportRef} className={cn("bg-background p-4", exporting && "p-4")}>
          <div className="hidden print:block">
            <h1 className="text-xl font-semibold">
              {dictionary.appName}: {dictionary.reports.heading} {formatDateUk(date)}
            </h1>
          </div>
          {exporting ? (
            <h1 className="text-xl font-semibold">
              {dictionary.appName}: {dictionary.reports.heading} {formatDateUk(date)}
            </h1>
          ) : null}

          <div className={cn(tab === "kitchen" || exporting ? "block" : "hidden", "print:block")}>
            <h2 className="mb-3 text-base font-semibold">{dictionary.reports.kitchenTitle}</h2>
            {!hasKitchen ? (
              <p className="text-sm text-muted-foreground">{dictionary.reports.kitchenEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.category}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.dish}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.orderedPortions}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.cancelledPortions}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.toIssue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitchen.map((row) => (
                      <tr key={`${row.dish_title}-${row.meal_type}`} className="border-t">
                        <td className="px-3 py-3">{dictionary.mealType[row.meal_type as MealType]}</td>
                        <td className="px-3 py-3">{row.dish_title}</td>
                        <td className="px-3 py-3">{row.portions}</td>
                        <td className="px-3 py-3">{row.cancelled_portions}</td>
                        <td className="px-3 py-3">{row.portions - row.cancelled_portions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={cn("mt-4", tab === "supply" || exporting ? "block" : "hidden", "print:block")}>
            <h2 className="mb-3 text-base font-semibold">{dictionary.reports.deliveryTitle}</h2>
            {!hasSupply ? (
              <p className="text-sm text-muted-foreground">{dictionary.reports.deliveryEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.location}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.breakfast}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.lunchFirst}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.lunchSecond}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.dinner}</th>
                      <th className="px-3 py-3 font-medium">{dictionary.reports.kits}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delivery.map((row) => (
                      <tr key={row.location_name} className="border-t">
                        <td className="px-3 py-3">{row.location_name}</td>
                        <td className="px-3 py-3">{row.breakfast_count}</td>
                        <td className="px-3 py-3">{row.lunch_first_count}</td>
                        <td className="px-3 py-3">{row.lunch_second_count}</td>
                        <td className="px-3 py-3">{row.dinner_count}</td>
                        <td className="px-3 py-3">{row.kits_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </ScreenState>
    </DashboardPage>
  );
}
