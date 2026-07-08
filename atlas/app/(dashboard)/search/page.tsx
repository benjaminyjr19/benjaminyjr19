import { PageHeader } from "@/components/layout/page-header";
import { SearchClient } from "@/components/search/search-client";

export const metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Search"
        description="Everything in Centre Intelligence, one search away."
      />
      <SearchClient />
    </div>
  );
}
