import Link from "next/link";

import { AtlasMark } from "@/components/layout/atlas-mark";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/env";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  // Middleware redirects to /today in preview mode; this is a graceful fallback.
  if (isDemoMode()) {
    return (
      <div className="space-y-6 text-center">
        <BrandHeader />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Atlas is running in preview mode with a sample centre — no sign-in needed.
        </p>
        <Button asChild className="w-full">
          <Link href="/today">Enter Atlas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BrandHeader />
      <LoginForm />
      <p className="text-center text-xs leading-relaxed text-muted-foreground/80">
        Your centre data stays private. Atlas never trains on it.
      </p>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <AtlasMark className="h-10 w-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Atlas</h1>
        <p className="text-sm text-muted-foreground">Atlas works. Teachers review.</p>
      </div>
    </div>
  );
}
