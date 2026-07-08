import { redirect } from "next/navigation";

import { AtlasMark } from "@/components/layout/atlas-mark";
import { getWorkspace } from "@/core/workspace/service";
import { isDemoMode } from "@/lib/env";

import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your centre" };

export default async function OnboardingPage() {
  if (isDemoMode()) redirect("/today");

  const workspace = await getWorkspace();
  if (workspace) redirect("/today");

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <AtlasMark className="h-10 w-10" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Welcome to Atlas</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            One question, then Atlas starts working for you.
          </p>
        </div>
      </div>
      <OnboardingForm />
    </div>
  );
}
