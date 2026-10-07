import { ScamPattern } from "./scamPattern.model.js";
import { builtInPatternTaxonomy } from "./patternTaxonomy.js";

/** Idempotently installs built-in patterns; it never overwrites admin-managed records. */
export async function seedBuiltInPatterns(): Promise<void> {
  for (const pattern of builtInPatternTaxonomy) {
    await ScamPattern.updateOne(
      { patternId: pattern.patternId, source: "built_in" },
      { $setOnInsert: { ...pattern, status: "active", source: "built_in", lastReviewedAt: new Date() } },
      { upsert: true },
    );
  }
}
