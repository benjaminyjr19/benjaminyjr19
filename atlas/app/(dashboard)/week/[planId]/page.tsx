import { notFound } from "next/navigation";

import { PlanEditor } from "@/components/editor/plan-editor";
import { getPlanWithContent } from "@/core/weekly-planning/service";
import { requireWorkspace } from "@/core/workspace/service";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const workspace = await requireWorkspace();

  const loaded = await getPlanWithContent(planId);
  if (!loaded || loaded.plan.centreId !== workspace.centre.id) notFound();

  return <PlanEditor plan={loaded.plan} versions={loaded.versions} />;
}
