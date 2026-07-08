import { Users } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Community"
        description="A place for teachers across centres to share what works."
      />
      <EmptyState
        icon={Users}
        title="Community coming soon"
        description="For now, contributions live inside your centre — every resource you share makes your Centre Intelligence stronger."
      />
    </div>
  );
}
