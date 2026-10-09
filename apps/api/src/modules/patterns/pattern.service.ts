import { ScamPattern } from './scamPattern.model.js';
import type { EvidenceChannel, FindingSeverity } from '../analyses/analysis.types.js';
import type { PatternDefinition } from './patternTaxonomy.js';

const evidenceChannels = new Set<EvidenceChannel>([
  'sms',
  'email',
  'chat',
  'social_media',
  'marketplace',
  'phone_call',
  'website',
  'unknown'
]);
const severities = new Set<FindingSeverity>(['info', 'low', 'medium', 'high', 'critical']);

/** Converts reviewed database taxonomy records into the pure analysis contract. */
export async function loadActivePatternDefinitions(): Promise<PatternDefinition[]> {
  const records = await ScamPattern.find({ status: 'active' })
    .select({
      patternId: 1,
      category: 1,
      name: 1,
      description: 1,
      indicators: 1,
      severity: 1,
      applicableChannels: 1,
      recommendedProtectiveActions: 1,
      aliases: 1,
      examples: 1,
      version: 1
    })
    .lean()
    .exec();

  return records.flatMap((record): PatternDefinition[] => {
    const indicators = record.indicators;
    const channels = (record.applicableChannels ?? []).filter((channel): channel is EvidenceChannel => evidenceChannels.has(channel as EvidenceChannel));
    if (!indicators || !severities.has(record.severity as FindingSeverity) || channels.length === 0) return [];

    const anyFindingCodes = Array.isArray(indicators.anyFindingCodes) ? indicators.anyFindingCodes : [];
    const allFindingCodes = Array.isArray(indicators.allFindingCodes) ? indicators.allFindingCodes : [];
    const entityKinds = Array.isArray(indicators.entityKinds) ? indicators.entityKinds : [];

    return [{
      patternId: record.patternId,
      category: record.category,
      name: record.name,
      description: record.description,
      indicators: {
        anyFindingCodes,
        ...(allFindingCodes.length > 0 ? { allFindingCodes } : {}),
        ...(entityKinds.length > 0 ? { entityKinds } : {}),
        minMatchedIndicators: typeof indicators.minMatchedIndicators === 'number' && indicators.minMatchedIndicators > 0 ? indicators.minMatchedIndicators : 1
      },
      severity: record.severity as FindingSeverity,
      applicableChannels: channels,
      recommendedProtectiveActions: Array.isArray(record.recommendedProtectiveActions) ? record.recommendedProtectiveActions : [],
      aliases: Array.isArray(record.aliases) ? record.aliases : [],
      examples: Array.isArray(record.examples) ? record.examples : [],
      version: record.version
    }];
  });
}
