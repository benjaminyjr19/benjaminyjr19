"use server";

import { revalidatePath } from "next/cache";

import {
  requireWorkspace,
  updateCentreName,
  updateUserName,
} from "@/core/workspace/service";

import type { ActionResult } from "./plans";

export async function updateCentreNameAction(name: string): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    if (!name.trim()) return { ok: false, error: "Centre name can't be empty." };
    await updateCentreName(workspace.centre.id, name);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[atlas:action]", error);
    return { ok: false, error: "The centre name couldn't be updated." };
  }
}

export async function updateProfileNameAction(fullName: string): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    if (!fullName.trim()) return { ok: false, error: "Name can't be empty." };
    await updateUserName(workspace.user.id, fullName);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[atlas:action]", error);
    return { ok: false, error: "Your name couldn't be updated." };
  }
}
