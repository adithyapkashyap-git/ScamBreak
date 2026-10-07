import { z } from "zod";

const domainSchema = z.string().trim().toLowerCase().regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Use a hostname, not a URL.");

export const trustedEntitySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    aliases: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
    category: z.string().trim().min(2).max(80),
    officialDomains: z.array(domainSchema).max(30).default([]),
    officialApps: z.array(z.object({ platform: z.enum(["ios", "android", "web"]), identifier: z.string().trim().min(2).max(500) }).strict()).max(20).default([]),
    officialSupportChannels: z.array(z.object({ type: z.enum(["website", "phone", "email", "app", "in_person"]), label: z.string().trim().min(2).max(120), value: z.string().trim().min(2).max(500), verified: z.boolean().default(false) }).strict()).max(30).default([]),
    verificationStatus: z.enum(["verified", "pending", "retired"]),
    verificationSource: z.string().url().max(1_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.verificationStatus === "verified" && !value.verificationSource) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verificationSource"], message: "A verified entity requires an independent verification source." });
    }
  });

export type TrustedEntityInput = z.infer<typeof trustedEntitySchema>;
