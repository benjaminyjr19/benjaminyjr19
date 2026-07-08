import { notFound } from "next/navigation";

import { ResourceEditor } from "@/components/editor/resource-editor";
import { listResourceVersions } from "@/core/resources/repo";
import { getLatestVersion, getResource } from "@/core/resources/service";
import { requireWorkspace } from "@/core/workspace/service";

export const dynamic = "force-dynamic";

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;
  const workspace = await requireWorkspace();

  const resource = await getResource(resourceId);
  if (!resource || resource.centreId !== workspace.centre.id) notFound();
  if (resource.visibility === "private" && resource.createdBy !== workspace.user.id) {
    notFound();
  }

  const [versions, latest] = await Promise.all([
    listResourceVersions(resource.id, workspace.centre.id),
    getLatestVersion(resource.id),
  ]);

  return (
    <ResourceEditor
      resource={resource}
      versions={versions}
      latestText={latest?.extractedText ?? ""}
      isOwner={resource.createdBy === workspace.user.id}
    />
  );
}
