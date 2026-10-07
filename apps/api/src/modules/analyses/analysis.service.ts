import { Buffer } from 'node:buffer';

import { config } from '../../config/index.js';
import { AppError } from '../../lib/AppError.js';
import { AnalysisFinding } from './analysisFinding.model.js';
import { Analysis } from './analysis.model.js';
import type { CreateAnalysisInput, EvidenceInput } from './analysis.schemas.js';
import { AnalysisEngine, type AnalysisPipelineResult, type EngineEvidence } from './analysisEngine.service.js';
import type { ExtractedEntityInput, RiskAssessmentInput, SafeAction, VerificationStep } from './analysis.types.js';
import { redactSensitiveText } from './dataSanitization.js';
import { RiskAssessment } from './riskAssessment.model.js';
import { EntityVerificationService } from '../entities/entityVerification.service.js';
import { Evidence } from '../evidence/evidence.model.js';
import { extractImageText } from '../evidence/imageEvidence.service.js';
import { fingerprintNormalizedEntity, normalizeEvidenceText } from '../evidence/textExtraction.service.js';
import {
  consumeImageUpload,
  deleteStoredUpload,
  restoreConsumedImageUpload,
  type ConsumedImageUpload
} from '../evidence/upload.service.js';
import { ExtractedEntity } from '../evidence/extractedEntity.model.js';
import { Upload } from '../evidence/upload.model.js';
import { loadActivePatternDefinitions } from '../patterns/pattern.service.js';
import { UrlAnalysis } from '../urlAnalysis/urlAnalysis.model.js';
import { Incident } from '../incidents/incident.model.js';
import { CommunityReport } from '../community/communityReport.model.js';

type PublicEvidenceDto = Readonly<{
  id: string;
  type: string;
  channel: string;
  label?: string;
  summary: string;
  extractionStatus: string;
  receivedAt?: string;
}>;

type PublicEntityDto = Readonly<{
  id: string;
  kind: string;
  displayValue: string;
  classification: string;
  source: string;
  confidence: string;
}>;

type PublicFindingDto = Readonly<{
  code: string;
  category: string;
  state: string;
  severity: string;
  confidence: string;
  title: string;
  explanation: string;
  evidence: Array<{ evidenceId: string; excerpt: string; entityKinds?: string[] }>;
  recommendedActionKeys: string[];
  patternIds: string[];
  source: string;
}>;

export type PublicAnalysisDto = Readonly<{
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  evidence: PublicEvidenceDto[];
  extractedEntities: PublicEntityDto[];
  findings: PublicFindingDto[];
  riskAssessment: {
    level: string;
    score: number | null;
    confidence: string;
    rationale: string[];
    limitations: string[];
    engineVersion: string;
    scoringConfigVersion: string;
    contributions: Array<{ findingCode: string; points: number; reason: string }>;
  } | null;
  recommendedActions: SafeAction[];
  verificationGuidance: VerificationStep[];
  patternIds: string[];
  aiStatus: string;
  limitations: string[];
}>;

export type PublicAnalysisSummaryDto = Readonly<{
  id: string;
  title?: string;
  status: string;
  riskLevel: string;
  evidenceCount: number;
  findingCount: number;
  createdAt: string;
  updatedAt: string;
}>;

const evidenceTypeLabel: Record<string, string> = {
  text: 'Pasted text',
  image: 'Screenshot image',
  url: 'Submitted URL',
  email: 'Copied email',
  message: 'Message',
  payment_request: 'Payment request',
  call_transcript: 'Call transcript',
  website_copy: 'Copied website text',
  manual: 'Manual details'
};

function summarizeEvidence(input: EvidenceInput): string {
  if (input.type === 'image') return 'Screenshot image kept in private evidence storage.';
  if (input.type === 'url') return 'Submitted URL for defensive, non-navigating inspection.';
  const length = (input.text ?? '').trim().length;
  return `${evidenceTypeLabel[input.type] ?? 'Evidence'} (${length} characters).`;
}

function toPublicEvidence(evidence: {
  publicId: string;
  type: string;
  channel: string;
  label?: string | null;
  displaySummary: string;
  extractionStatus: string;
  metadata?: { receivedAt?: Date | null } | null;
}): PublicEvidenceDto {
  return {
    id: evidence.publicId,
    type: evidence.type,
    channel: evidence.channel,
    ...(evidence.label ? { label: evidence.label } : {}),
    summary: evidence.displaySummary,
    extractionStatus: evidence.extractionStatus,
    ...(evidence.metadata?.receivedAt ? { receivedAt: evidence.metadata.receivedAt.toISOString() } : {})
  };
}

function toPublicFinding(finding: {
  code: string;
  category: string;
  state: string;
  severity: string;
  confidence: string;
  title: string;
  explanation: string;
  evidence: Array<{ evidencePublicId: string; excerpt: string; entityKinds?: string[] }>;
  recommendedActionKeys: string[];
  patternIds: string[];
  source: string;
}): PublicFindingDto {
  return {
    code: finding.code,
    category: finding.category,
    state: finding.state,
    severity: finding.severity,
    confidence: finding.confidence,
    title: finding.title,
    explanation: finding.explanation,
    evidence: finding.evidence.map((reference) => ({
      evidenceId: reference.evidencePublicId,
      excerpt: reference.excerpt,
      ...(reference.entityKinds?.length ? { entityKinds: reference.entityKinds } : {})
    })),
    recommendedActionKeys: finding.recommendedActionKeys,
    patternIds: finding.patternIds,
    source: finding.source
  };
}

function toSummary(analysis: {
  publicId: string;
  title?: string | null;
  status: string;
  riskLevel: string;
  evidenceCount: number;
  findingCount: number;
  createdAt: Date;
  updatedAt: Date;
}): PublicAnalysisSummaryDto {
  return {
    id: analysis.publicId,
    ...(analysis.title ? { title: analysis.title } : {}),
    status: analysis.status,
    riskLevel: analysis.riskLevel,
    evidenceCount: analysis.evidenceCount,
    findingCount: analysis.findingCount,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString()
  };
}

function encodeCursor(input: { createdAt: Date; publicId: string }): string {
  return Buffer.from(JSON.stringify([input.createdAt.toISOString(), input.publicId]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; publicId: string } {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(decoded) || typeof decoded[0] !== 'string' || typeof decoded[1] !== 'string') throw new Error('Invalid cursor');
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime()) || !/^anl_[A-Za-z0-9_-]{16,}$/.test(decoded[1])) throw new Error('Invalid cursor');
    return { createdAt, publicId: decoded[1] };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}

function getTextualPayload(input: EvidenceInput): { rawText?: string; normalizedText?: string; submittedUrl?: string; engineText?: string; engineUrl?: string } {
  const rawText = input.text?.trim();
  const submittedUrl = input.url?.trim() || (input.type === 'url' ? rawText : undefined);
  const engineText = rawText && input.type !== 'url' ? rawText : undefined;
  return {
    ...(rawText ? { rawText, normalizedText: normalizeEvidenceText(rawText) } : {}),
    ...(submittedUrl ? { submittedUrl } : {}),
    ...(engineText ? { engineText } : {}),
    ...(submittedUrl ? { engineUrl: submittedUrl } : {})
  };
}

function genericFailure(): AppError {
  return new AppError(500, 'ANALYSIS_FAILED', 'ScamBreak could not safely complete this analysis. Please try again.');
}

export class AnalysisService {
  private readonly entityVerificationService = new EntityVerificationService();

  async create(ownerUserId: string, input: CreateAnalysisInput): Promise<PublicAnalysisDto> {
    const analysis = await Analysis.create({
      ownerUserId,
      ...(input.title ? { title: redactSensitiveText(input.title, 160) } : {}),
      status: 'processing',
      locale: input.locale,
      engineVersion: 'analysis-engine/1.0.0',
      scoringConfigVersion: 'risk-score/1.0.0'
    });

    const reservedUploads: ConsumedImageUpload[] = [];
    try {
      const persistedEvidence = new Map<string, { _id: unknown; publicId: string }>();
      const engineEvidence: EngineEvidence[] = [];

      for (const item of input.evidence) {
        let imageUpload: ConsumedImageUpload | undefined;
        let extractionStatus: 'pending' | 'complete' | 'failed' | 'unavailable' = 'complete';
        let extractionErrorCode: string | undefined;
        let ocrText: string | undefined;
        let storage: Record<string, unknown> | undefined;

        if (item.type === 'image') {
          imageUpload = await consumeImageUpload({ publicId: item.filePublicId!, ownerUserId, analysisId: analysis._id });
          reservedUploads.push(imageUpload);
          storage = {
            provider: imageUpload.storage.provider,
            key: imageUpload.storage.key,
            mimeType: imageUpload.storage.mimeType,
            sizeBytes: imageUpload.storage.sizeBytes,
            sha256: imageUpload.storage.sha256,
            ...(imageUpload.storage.width ? { width: imageUpload.storage.width } : {}),
            ...(imageUpload.storage.height ? { height: imageUpload.storage.height } : {}),
            scanStatus: 'unavailable'
          };
          const ocr = await extractImageText({ storageKey: imageUpload.storage.key, mimeType: imageUpload.storage.mimeType });
          if (ocr.status === 'complete') {
            ocrText = ocr.text;
            extractionStatus = 'complete';
          } else {
            extractionStatus = 'unavailable';
            extractionErrorCode = ocr.status === 'failed' ? 'OCR_FAILED' : 'OCR_UNAVAILABLE';
          }
        }

        const textual = getTextualPayload(item);
        const evidence = await Evidence.create({
          analysisId: analysis._id,
          ownerUserId,
          type: item.type,
          channel: item.channel,
          ...(item.label ? { label: redactSensitiveText(item.label, 120) } : {}),
          displaySummary: summarizeEvidence(item),
          classification: item.type === 'image' ? 'restricted' : 'private',
          content: {
            ...(textual.rawText ? { rawText: textual.rawText } : {}),
            ...(textual.normalizedText ? { normalizedText: textual.normalizedText } : {}),
            ...(ocrText ? { ocrText } : {}),
            ...(textual.submittedUrl ? { submittedUrl: textual.submittedUrl } : {})
          },
          ...(storage ? { storage } : {}),
          ...(item.metadata
            ? {
                metadata: {
                  ...(item.metadata.senderLabel ? { senderLabel: item.metadata.senderLabel } : {}),
                  ...(item.metadata.receivedAt ? { receivedAt: item.metadata.receivedAt } : {}),
                  ...(item.metadata.languageHint ? { languageHint: item.metadata.languageHint } : {})
                }
              }
            : {}),
          extractionStatus,
          ...(extractionErrorCode ? { extractionErrorCode } : {})
        });
        persistedEvidence.set(evidence.publicId, { _id: evidence._id, publicId: evidence.publicId });
        engineEvidence.push({
          publicId: evidence.publicId,
          type: item.type,
          channel: item.channel,
          ...(textual.engineText ? { text: textual.engineText } : {}),
          ...(textual.engineUrl ? { submittedUrl: textual.engineUrl } : {}),
          ...(ocrText ? { ocrText } : {})
        });
      }

      const definitions = await loadActivePatternDefinitions();
      const engine = new AnalysisEngine({
        entityVerificationService: this.entityVerificationService,
        ...(definitions.length > 0 ? { patternDefinitions: definitions } : {})
      });
      const result = await engine.analyze({
        evidence: engineEvidence,
        locale: input.locale,
        allowExternalAiProcessing: input.allowExternalAiProcessing
      });

      await this.persistPipelineResult({ analysisId: analysis._id, evidenceByPublicId: persistedEvidence, result });
      analysis.status = 'complete';
      analysis.riskLevel = result.risk.level;
      analysis.evidenceCount = engineEvidence.length;
      analysis.findingCount = result.findings.length;
      analysis.engineVersion = result.risk.engineVersion;
      analysis.scoringConfigVersion = result.risk.scoringConfigVersion;
      analysis.set('safeActions', result.safeActions);
      analysis.set('verificationSteps', result.verificationSteps);
      analysis.matchedPatternIds = result.matchedPatternIds;
      analysis.analysisLimitations = result.limitations;
      analysis.aiStatus = result.aiStatus;
      await analysis.save();

      return this.get(ownerUserId, analysis.publicId);
    } catch (error) {
      // An analysis is assembled across several collections. If a later
      // pipeline stage fails, remove every partial private record before the
      // staged image is made available again. Restoring only the Upload record
      // would allow the same object to be attached twice while a partial
      // Evidence record still referenced it.
      await Promise.allSettled([
        Evidence.deleteMany({ analysisId: analysis._id, ownerUserId }).exec(),
        ExtractedEntity.deleteMany({ analysisId: analysis._id }).exec(),
        AnalysisFinding.deleteMany({ analysisId: analysis._id }).exec(),
        RiskAssessment.deleteMany({ analysisId: analysis._id }).exec(),
        UrlAnalysis.deleteMany({ analysisId: analysis._id }).exec()
      ]);
      await Promise.allSettled(
        reservedUploads.map((upload) => restoreConsumedImageUpload({ publicId: upload.publicId, ownerUserId }))
      );
      await Analysis.updateOne(
        { _id: analysis._id, status: 'processing' },
        { $set: { status: 'failed', processingError: { code: 'ANALYSIS_FAILED', message: 'The analysis did not complete safely.' } } }
      ).exec();
      if (error instanceof AppError) throw error;
      throw genericFailure();
    }
  }

  private async persistPipelineResult(input: {
    analysisId: unknown;
    evidenceByPublicId: Map<string, { _id: unknown; publicId: string }>;
    result: AnalysisPipelineResult;
  }): Promise<void> {
    const entityDocuments = input.result.entities.flatMap((entity) => {
      const evidence = input.evidenceByPublicId.get(entity.sourceEvidencePublicId);
      if (!evidence) return [];
      return [{
        analysisId: input.analysisId,
        evidenceId: evidence._id,
        kind: entity.kind,
        value: entity.value,
        normalizedValue: entity.normalizedValue,
        displayValue: entity.displayValue,
        valueHash: fingerprintNormalizedEntity(entity.normalizedValue, config.privacy.entityHashPepper),
        classification: entity.classification,
        source: entity.source,
        confidence: entity.confidence,
        ...(entity.startOffset !== undefined ? { startOffset: entity.startOffset } : {}),
        ...(entity.endOffset !== undefined ? { endOffset: entity.endOffset } : {})
      }];
    });

    if (entityDocuments.length > 0) await ExtractedEntity.insertMany(entityDocuments, { ordered: true });
    if (input.result.findings.length > 0) {
      await AnalysisFinding.insertMany(
        input.result.findings.map((finding) => ({
          analysisId: input.analysisId,
          code: finding.code,
          category: finding.category,
          state: finding.state,
          severity: finding.severity,
          confidence: finding.confidence,
          title: finding.title,
          explanation: finding.explanation,
          evidence: finding.evidence,
          recommendedActionKeys: finding.recommendedActionKeys,
          patternIds: finding.patternIds ?? [],
          ...(finding.technicalDetails ? { technicalDetails: finding.technicalDetails } : {}),
          source: finding.source
        })),
        { ordered: true }
      );
    }

    const risk = input.result.risk as RiskAssessmentInput;
    await RiskAssessment.create({ analysisId: input.analysisId, ...risk });

    const urlDocuments = input.result.urlResults.flatMap(({ evidencePublicId, result }) => {
      const evidence = input.evidenceByPublicId.get(evidencePublicId);
      if (!evidence || !result.normalized) return [];
      return [{
        analysisId: input.analysisId,
        evidenceId: evidence._id,
        canonicalUrl: result.normalized.canonicalUrl,
        hostname: result.normalized.hostname,
        protocol: result.normalized.protocol,
        safeForRemoteLookup: result.normalized.safeForRemoteLookup,
        providerResults: result.providerResults
      }];
    });
    if (urlDocuments.length > 0) await UrlAnalysis.insertMany(urlDocuments, { ordered: true });
  }

  async get(ownerUserId: string, publicId: string): Promise<PublicAnalysisDto> {
    const analysis = await Analysis.findOne({ ownerUserId, publicId, status: { $ne: 'deleted' } }).exec();
    if (!analysis) throw new AppError(404, 'ANALYSIS_NOT_FOUND', 'This analysis was not found.');

    const [evidence, findings, entities, risk] = await Promise.all([
      Evidence.find({ analysisId: analysis._id, deletedAt: { $exists: false } }).sort({ createdAt: 1 }).exec(),
      AnalysisFinding.find({ analysisId: analysis._id }).sort({ severity: -1, createdAt: 1 }).exec(),
      ExtractedEntity.find({ analysisId: analysis._id }).sort({ createdAt: 1 }).exec(),
      RiskAssessment.findOne({ analysisId: analysis._id }).exec()
    ]);

    return {
      id: analysis.publicId,
      ...(analysis.title ? { title: analysis.title } : {}),
      status: analysis.status,
      createdAt: analysis.createdAt.toISOString(),
      updatedAt: analysis.updatedAt.toISOString(),
      evidence: evidence.map(toPublicEvidence),
      extractedEntities: entities.map((entity) => ({
        id: entity.publicId,
        kind: entity.kind,
        displayValue: entity.displayValue,
        classification: entity.classification,
        source: entity.source,
        confidence: entity.confidence
      })),
      findings: findings.map(toPublicFinding),
      riskAssessment: risk
        ? {
            level: risk.level,
            score: risk.score ?? null,
            confidence: risk.confidence,
            rationale: risk.rationale,
            limitations: risk.limitations,
            engineVersion: risk.engineVersion,
            scoringConfigVersion: risk.scoringConfigVersion,
            contributions: risk.contributions.map((contribution) => ({
              findingCode: contribution.findingCode,
              points: contribution.points,
              reason: contribution.reason
            }))
          }
        : null,
      recommendedActions: analysis.safeActions,
      verificationGuidance: analysis.verificationSteps,
      patternIds: analysis.matchedPatternIds,
      aiStatus: analysis.aiStatus,
      limitations: analysis.analysisLimitations
    };
  }

  async list(ownerUserId: string, input: { cursor?: string; limit: number }): Promise<{ items: PublicAnalysisSummaryDto[]; nextCursor?: string }> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const filter: Record<string, unknown> = { ownerUserId, status: { $ne: 'deleted' } };
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, publicId: { $lt: cursor.publicId } }
      ];
    }
    const records = await Analysis.find(filter).sort({ createdAt: -1, publicId: -1 }).limit(input.limit + 1).exec();
    const hasMore = records.length > input.limit;
    const page = hasMore ? records.slice(0, input.limit) : records;
    const final = page.at(-1);
    return {
      items: page.map(toSummary),
      ...(hasMore && final ? { nextCursor: encodeCursor(final) } : {})
    };
  }

  async remove(ownerUserId: string, publicId: string): Promise<void> {
    const analysis = await Analysis.findOne({ ownerUserId, publicId, status: { $ne: 'deleted' } }).exec();
    if (!analysis) throw new AppError(404, 'ANALYSIS_NOT_FOUND', 'This analysis was not found.');

    const evidence = await Evidence.find({ analysisId: analysis._id }).select('+storage.key').exec();
    await Promise.allSettled(
      evidence.map((item) =>
        deleteStoredUpload({
          provider: item.storage?.provider ?? undefined,
          key: item.storage?.key ?? undefined
        })
      )
    );
    const now = new Date();
    await Promise.all([
      Evidence.updateMany(
        { analysisId: analysis._id },
        {
          $set: { deletedAt: now },
          $unset: {
            'content.rawText': 1,
            'content.normalizedText': 1,
            'content.ocrText': 1,
            'content.submittedUrl': 1,
            'storage.key': 1,
            'storage.sha256': 1,
            'metadata.senderLabel': 1
          }
        }
      ).exec(),
      ExtractedEntity.deleteMany({ analysisId: analysis._id }).exec(),
      AnalysisFinding.deleteMany({ analysisId: analysis._id }).exec(),
      RiskAssessment.deleteMany({ analysisId: analysis._id }).exec(),
      UrlAnalysis.deleteMany({ analysisId: analysis._id }).exec(),
      Upload.deleteMany({ analysisId: analysis._id }).exec(),
      // Incident notes are private evidence too; remove response records tied
      // to this analysis. Community reports are intentionally separate opt-in
      // objects, so only their deleted-analysis link is removed.
      Incident.deleteMany({ analysisId: analysis._id }).exec(),
      CommunityReport.updateMany({ sourceAnalysisId: analysis._id }, { $unset: { sourceAnalysisId: 1 } }).exec()
    ]);
    analysis.status = 'deleted';
    analysis.deletedAt = now;
    analysis.set('safeActions', []);
    analysis.set('verificationSteps', []);
    analysis.matchedPatternIds = [];
    analysis.analysisLimitations = [];
    await analysis.save();
  }
}

export const analysisService = new AnalysisService();
