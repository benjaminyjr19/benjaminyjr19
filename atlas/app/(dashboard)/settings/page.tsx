import { Lock, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/core/workspace/service";
import { isAIConnected, isDemoMode } from "@/lib/env";

import { CentreNameForm, ProfileNameForm } from "./settings-forms";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await requireWorkspace();
  const aiConnected = isAIConnected();
  const demo = isDemoMode();

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Your centre, your profile, your privacy." />

      <Card>
        <CardHeader>
          <CardTitle>Centre</CardTitle>
          <CardDescription>
            Shared with everyone at {workspace.centre.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CentreNameForm initialName={workspace.centre.name} />
          <p className="text-xs text-muted-foreground/70">
            Timezone: {workspace.centre.timezone}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to colleagues in your centre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileNameForm initialName={workspace.user.fullName} />
          <p className="text-xs text-muted-foreground/70">{workspace.user.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Atlas intelligence
            {aiConnected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="quiet">Built-in</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {aiConnected
              ? "Atlas is connected to a managed intelligence service and chooses the right approach for each task."
              : "Atlas is running on its built-in planning intelligence. Connect an intelligence key (see the project README) for richer generation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You choose outcomes — a prepared week, a filed resource — and Atlas handles the
            rest. There are no models to pick or parameters to tune here, by design.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Privacy
          </CardTitle>
          <CardDescription>Your centre data stays private.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            <li>· Only members of your centre can see your centre&apos;s data — enforced at the database layer with row-level security.</li>
            <li>· New uploads start private to you; sharing to Centre Intelligence is always your explicit choice.</li>
            <li>· Atlas never trains on your centre&apos;s data.</li>
            <li>· Atlas doesn&apos;t store child profiles — plans and observations reference practice, not children&apos;s records.</li>
            {demo ? (
              <li>· Preview mode keeps everything in memory on this machine — nothing leaves it.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
