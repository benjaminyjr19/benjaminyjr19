import type { WeeklyPlan, WeeklyPlanContent } from "@/lib/types";
import { formatWeekRange } from "@/lib/utils/dates";

/**
 * Export a weekly plan as clean markdown — used for copy-to-clipboard,
 * .md download, and contributing plans back into Centre Intelligence.
 *
 * TODO(post-MVP): DOCX and PDF export (docx npm package / headless render).
 */
export function planToMarkdown(plan: WeeklyPlan, content: WeeklyPlanContent): string {
  const lines: string[] = [];

  lines.push(`# ${plan.theme}`);
  lines.push(
    `Week of ${formatWeekRange(plan.weekStart, plan.weekEnd)} · ${plan.className ?? plan.ageGroup}`,
  );
  lines.push("");
  lines.push("## Weekly overview");
  lines.push(content.overview);
  lines.push("");

  lines.push("## Learning goals");
  for (const goal of content.learningGoals) lines.push(`- ${goal}`);
  lines.push("");

  for (const day of content.days) {
    lines.push(`## ${day.label} — ${day.title}`);
    for (const block of day.blocks) {
      lines.push(`### ${block.title}`);
      lines.push(block.description);
      if (block.materials.length > 0) {
        lines.push(`*Materials: ${block.materials.join(", ")}*`);
      }
      lines.push("");
    }
  }

  lines.push("## Materials checklist");
  for (const item of content.materials) {
    const day = item.day ? ` (${item.day})` : "";
    const detail = item.detail ? ` — ${item.detail}` : "";
    lines.push(`- [${item.ready ? "x" : " "}] ${item.item}${day}${detail}`);
  }
  lines.push("");

  lines.push("## Observation opportunities");
  for (const obs of content.observationOpportunities) {
    lines.push(`- **${obs.focus}**${obs.day ? ` (${obs.day})` : ""}: ${obs.prompt}`);
  }
  lines.push("");

  if (content.rainyDayAlternatives.length > 0) {
    lines.push("## Rainy-day alternatives");
    for (const alt of content.rainyDayAlternatives) {
      lines.push(`- **${alt.title}**${alt.replaces ? ` (replaces ${alt.replaces})` : ""}: ${alt.description}`);
    }
    lines.push("");
  }

  lines.push("## Reflection prompts");
  for (const prompt of content.reflectionPrompts) lines.push(`- ${prompt}`);
  lines.push("");

  if (content.sources.length > 0) {
    lines.push("## Sources Atlas used");
    for (const source of content.sources) {
      lines.push(`- **${source.title}** — ${source.usage}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
