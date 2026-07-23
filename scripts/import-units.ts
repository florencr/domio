import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runUnitsImport } from "../lib/units/run-units-import";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      const val = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const siteNameArg = process.argv[2] ?? "sofia";
  const fileArg = process.argv[3] ?? "scripts/data/sofia-units.tsv";

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sites, error: siteErr } = await admin.from("sites").select("id,name").ilike("name", `%${siteNameArg}%`);
  if (siteErr) {
    console.error(siteErr.message);
    process.exit(1);
  }
  if (!sites?.length) {
    console.error(`No site found matching "${siteNameArg}"`);
    process.exit(1);
  }
  const site = sites[0] as { id: string; name: string };
  console.log(`Site: ${site.name} (${site.id})`);

  const csv = readFileSync(resolve(process.cwd(), fileArg), "utf8");
  const result = await runUnitsImport(admin, site.id, csv);

  const { data: unitCount } = await admin
    .from("units")
    .select("id", { count: "exact", head: true })
    .in(
      "building_id",
      (await admin.from("buildings").select("id").eq("site_id", site.id)).data?.map((b: { id: string }) => b.id) ?? []
    );

  console.log(JSON.stringify({ ...result, totalUnitsInDb: unitCount }, null, 2));
  if (result.skipped.length) console.error("Skipped:", result.skipped.slice(0, 10).join("; "));
  if (result.warnings.length) console.warn("Warnings:", result.warnings.slice(0, 10).join("; "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
