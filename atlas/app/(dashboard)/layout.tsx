import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { requireWorkspace } from "@/core/workspace/service";
import { isDemoMode } from "@/lib/env";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await requireWorkspace();
  const demo = isDemoMode();

  return (
    <div className="min-h-screen">
      <Sidebar
        userName={workspace.user.fullName}
        centreName={workspace.centre.name}
        demoMode={demo}
      />
      <MobileNav />
      <main className="pb-24 md:pb-0 md:pl-60">
        {demo ? (
          <div className="flex justify-center px-6 pt-4">
            <p className="rounded-full bg-primary-soft px-3.5 py-1 text-xs text-accent-foreground">
              Preview mode — exploring Atlas with a sample centre. Connect Supabase to go live.
            </p>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-4xl animate-fade-up px-6 py-10 md:px-10 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
