import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";
import { runUnitsImport } from "@/lib/units/run-units-import";

export async function POST(request: Request) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const body = await request.json();
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) return NextResponse.json({ error: "csv text required" }, { status: 400 });

    let result;
    try {
      result = await runUnitsImport(admin, siteId, csv);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid CSV" }, { status: 400 });
    }

    if (result.imported === 0) {
      return NextResponse.json(
        {
          error: result.skipped.length
            ? `No units imported. First issues: ${result.skipped.slice(0, 3).join("; ")}`
            : "No units imported.",
          ...result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
