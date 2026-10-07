import type { VerificationStep } from "../analyses/analysis.types.js";
import { TrustedEntity } from "./trustedEntity.model.js";

export type EntityClaimVerification = {
  claimedName: string;
  status: "matched_official_domain" | "known_entity_unverified_claim" | "entity_not_in_trusted_directory";
  trustedEntity?: { publicId: string; name: string; officialDomains: string[]; lastVerifiedAt?: Date };
  guidance: VerificationStep[];
};

function normalizeClaim(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function independentGuidance(entityName?: string): VerificationStep[] {
  const object = entityName ? entityName : "the organization";
  return [
    {
      key: "find_official_site_independently",
      title: "Find the official website or app independently",
      description: `Search for ${object}'s official site yourself or open its official app directly. Do not use the link supplied in the message.`,
      avoidUntrustedContact: true,
    },
    {
      key: "use_trusted_support_channel",
      title: "Use a trusted support channel",
      description: "Contact support using a number or channel from an independently found official source, account statement, or official app.",
      avoidUntrustedContact: true,
    },
  ];
}

export class EntityVerificationService {
  async findUrlCandidates(): Promise<Array<{ name: string; officialDomains: string[] }>> {
    const records = await TrustedEntity.find({ verificationStatus: "verified" })
      .select({ name: 1, officialDomains: 1 })
      .lean();
    return records.filter((record) => record.officialDomains.length > 0).map((record) => ({ name: record.name, officialDomains: record.officialDomains }));
  }

  async verifyClaim(claimedName: string, submittedDomain?: string): Promise<EntityClaimVerification> {
    const normalizedName = normalizeClaim(claimedName);
    const entity = await TrustedEntity.findOne({
      verificationStatus: "verified",
      $or: [{ normalizedName }, { aliases: normalizedName }],
    })
      .select({ publicId: 1, name: 1, officialDomains: 1, lastVerifiedAt: 1 })
      .lean();

    if (!entity) {
      return { claimedName, status: "entity_not_in_trusted_directory", guidance: independentGuidance(claimedName) };
    }

    const matchesDomain = Boolean(submittedDomain && entity.officialDomains.some((domain) => submittedDomain === domain || submittedDomain.endsWith(`.${domain}`)));
    return {
      claimedName,
      status: matchesDomain ? "matched_official_domain" : "known_entity_unverified_claim",
      trustedEntity: {
        publicId: entity.publicId,
        name: entity.name,
        officialDomains: entity.officialDomains,
        ...(entity.lastVerifiedAt ? { lastVerifiedAt: entity.lastVerifiedAt } : {}),
      },
      guidance: matchesDomain
        ? [{ key: "verify_context_in_official_app", title: "Confirm the specific request in the official app or account", description: "A matching domain reduces one risk signal but does not prove that a specific request is genuine. Check the request after signing in through your usual official app or address.", avoidUntrustedContact: true }]
        : independentGuidance(entity.name),
    };
  }
}
