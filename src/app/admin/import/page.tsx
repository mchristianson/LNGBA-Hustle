import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getActiveSeason } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requireAdmin();
  const season = await getActiveSeason();
  if (!season) redirect("/admin");
  return (
    <div className="flex flex-col gap-4">
      <PageTitle eyebrow={`Admin · ${season.name}`}>Import roster</PageTitle>
      <p>
        Export the roster spreadsheet as CSV (in Google Sheets: File → Download → CSV) and upload it here.
        One row per player. You can import again later; existing players and parents are updated, not duplicated.
      </p>
      <ImportForm seasonId={season.id} />
    </div>
  );
}
