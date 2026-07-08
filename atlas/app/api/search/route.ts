import { NextResponse } from "next/server";

import { searchCentreIntelligence } from "@/core/centre-intelligence/search";
import { getWorkspace } from "@/core/workspace/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await searchCentreIntelligence(workspace, query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[atlas:search]", error);
    return NextResponse.json(
      { error: "Search is having a moment. Please try again." },
      { status: 500 },
    );
  }
}
