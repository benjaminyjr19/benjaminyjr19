import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { PrepareWeekForm } from "@/components/editor/prepare-week-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listPlans } from "@/core/weekly-planning/service";
import { requireWorkspace } from "@/core/workspace/service";
import { addDays, formatWeekRange, toISODate, upcomingMonday } from "@/lib/utils/dates";

export const metadata = { title: "Week" };
export const dynamic = "force-dynamic";

export default async function WeekIndexPage() {
  const workspace = await requireWorkspace();
  const plans = await listPlans(workspace.centre.id);

  const monday = upcomingMonday();
  let weekStart = toISODate(monday);
  let weekEnd = toISODate(addDays(monday, 4));

  // If the upcoming week is already planned, default the form to the week after.
  while (plans.some((p) => p.weekStart === weekStart)) {
    const next = addDays(new Date(weekStart), 7);
    weekStart = toISODate(next);
    weekEnd = toISODate(addDays(next, 4));
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Your weeks"
        description="Atlas prepares each week from Centre Intelligence. You review, adjust and approve."
      />

      <PrepareWeekForm
        defaultWeekStart={weekStart}
        defaultWeekEnd={weekEnd}
        weekRangeLabel={formatWeekRange(weekStart, weekEnd)}
      />

      {plans.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Planned weeks
          </h2>
          <div className="flex flex-col gap-3">
            {plans.map((plan) => (
              <Link key={plan.id} href={`/week/${plan.id}`} className="group block">
                <Card className="flex items-center gap-4 p-5 transition-all group-hover:shadow-calm-lg">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <CalendarDays className="h-4 w-4 text-primary" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{plan.theme}</p>
                    <p className="text-xs text-muted-foreground">
                      Week of {formatWeekRange(plan.weekStart, plan.weekEnd)} ·{" "}
                      {plan.className ?? plan.ageGroup}
                    </p>
                  </div>
                  {plan.status === "approved" ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge>Ready for review</Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
