import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface AnalysisScannerProps {
  evidenceCount: number;
  caseTitle?: string;
  allowAi?: boolean;
}

const TELEMETRY_PHASES = [
  {
    tag: 'NET-01',
    label: 'Decomposing URL & protocol structure',
    sub: 'Parsing hostnames, homoglyphs, and IP routing without browser navigation',
  },
  {
    tag: 'SIG-02',
    label: 'Scanning urgency & psychological pressure',
    sub: 'Evaluating artificial deadlines, coercive threats, and emotional manipulation',
  },
  {
    tag: 'SIG-03',
    label: 'Extracting credential & payment requests',
    sub: 'Detecting requests for OTPs, PINs, wire destinations, and remote access tools',
  },
  {
    tag: 'TAX-04',
    label: 'Correlating scam pattern taxonomy',
    sub: 'Cross-referencing known tactics, impersonation signatures, and delivery pretexts',
  },
  {
    tag: 'DIR-05',
    label: 'Validating against verified entity registry',
    sub: 'Comparing sender claims against authoritative domains and official channels',
  },
  {
    tag: 'RSK-06',
    label: 'Calculating explainable risk heuristics',
    sub: 'Applying deterministic multi-signal scoring model and identifying evidence limits',
  },
  {
    tag: 'ACT-07',
    label: 'Synthesizing prioritized safe response plan',
    sub: 'Formulating independent verification routes and immediate defensive actions',
  },
];

export function AnalysisScanner({ evidenceCount, caseTitle, allowAi }: AnalysisScannerProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % TELEMETRY_PHASES.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  const activePhase = TELEMETRY_PHASES[phaseIndex];

  return (
    <div
      className="analysis-scanner-overlay"
      role="status"
      aria-live="polite"
      aria-label="Analyzing evidence in progress"
    >
      <div className="analysis-scanner-modal">
        {/* Top HUD bar */}
        <div className="scanner-hud-bar">
          <div className="scanner-hud-status">
            <span className="status-dot" />
            <span>SANDBOX TELEMETRY ACTIVE</span>
          </div>
          <div className="scanner-hud-telemetry">
            <span className="scanner-tag">DEF-ENGINE v2.4</span>
            <span className="scanner-tag scanner-tag-secure">ISOLATED</span>
          </div>
        </div>

        {/* Central Holographic / Radar Scanning Reticle */}
        <div className="scanner-reticle-wrap">
          <svg
            className="scanner-reticle"
            viewBox="0 0 280 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Outer coordinate ring with tick marks */}
            <circle
              className="scanner-ring-outer"
              cx="140"
              cy="140"
              r="132"
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
            />
            {/* Secondary steady ring */}
            <circle
              className="scanner-ring-mid"
              cx="140"
              cy="140"
              r="105"
              stroke="var(--line)"
              strokeWidth="1"
            />
            {/* Inner dashed counter-rotating ring */}
            <circle
              className="scanner-ring-inner"
              cx="140"
              cy="140"
              r="76"
              stroke="var(--brand)"
              strokeWidth="1.5"
              strokeDasharray="16 12 4 12"
              opacity="0.65"
            />
            {/* Center target circle */}
            <circle
              className="scanner-ring-center"
              cx="140"
              cy="140"
              r="46"
              stroke="var(--line-highlight)"
              strokeWidth="1.2"
            />

            {/* Crosshair axes */}
            <line x1="140" y1="12" x2="140" y2="268" stroke="var(--line)" strokeWidth="0.8" opacity="0.4" />
            <line x1="12" y1="140" x2="268" y2="140" stroke="var(--line)" strokeWidth="0.8" opacity="0.4" />

            {/* Corner HUD reticle brackets */}
            {/* Top Left */}
            <path d="M48 64 H64 V48" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
            {/* Top Right */}
            <path d="M232 64 H216 V48" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
            {/* Bottom Left */}
            <path d="M48 216 H64 V232" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
            {/* Bottom Right */}
            <path d="M232 216 H216 V232" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />

            {/* Cardinal telemetry beacon dots */}
            <circle className="scanner-node scanner-node-top" cx="140" cy="35" r="3.5" fill="var(--brand)" />
            <circle className="scanner-node scanner-node-right" cx="245" cy="140" r="3.5" fill="var(--brand)" />
            <circle className="scanner-node scanner-node-bottom" cx="140" cy="245" r="3.5" fill="var(--brand)" />
            <circle className="scanner-node scanner-node-left" cx="35" cy="140" r="3.5" fill="var(--brand)" />

            {/* Rotating radar sweep beam */}
            <g className="scanner-sweep-group">
              <path
                d="M140 140 L245 140 A105 105 0 0 0 140 35 Z"
                fill="url(#radarGradient)"
                opacity="0.32"
              />
              <line x1="140" y1="140" x2="245" y2="140" stroke="var(--brand)" strokeWidth="1.8" opacity="0.9" />
            </g>

            {/* Gradients */}
            <defs>
              <radialGradient id="radarGradient" cx="140" cy="140" r="105" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
              </radialGradient>
            </defs>
          </svg>

          {/* Central Shield Hologram */}
          <div className="scanner-center-shield">
            <Icon name="shield" size={28} />
          </div>
        </div>

        {/* Live Audio/Data Equalizer telemetry line */}
        <div className="scanner-telemetry-wave" aria-hidden="true">
          <span className="wave-bar bar-1" />
          <span className="wave-bar bar-2" />
          <span className="wave-bar bar-3" />
          <span className="wave-bar bar-4" />
          <span className="wave-bar bar-5" />
          <span className="wave-bar bar-6" />
          <span className="wave-bar bar-7" />
          <span className="wave-bar bar-8" />
        </div>

        {/* Primary Status Copy */}
        <div className="scanner-copy">
          <h2 className="scanner-title">Analyzing evidence…</h2>
          {caseTitle ? (
            <p className="scanner-case-name">Case: <strong>{caseTitle}</strong></p>
          ) : null}

          {/* Cycling Inspection Stage Pill */}
          <div className="scanner-stage-card">
            <div className="scanner-stage-topline">
              <span className="scanner-stage-tag">{activePhase.tag}</span>
              <span className="scanner-stage-title">{activePhase.label}</span>
            </div>
            <p className="scanner-stage-detail">{activePhase.sub}</p>
          </div>

          {/* Evidence context chips */}
          <div className="scanner-chips">
            <span className="scanner-chip">
              <Icon name="file" size={13} />
              {evidenceCount} evidence item{evidenceCount === 1 ? '' : 's'}
            </span>
            <span className="scanner-chip">
              <Icon name="lock" size={13} />
              Isolated sandbox
            </span>
            {allowAi && (
              <span className="scanner-chip scanner-chip-ai">
                <Icon name="scan" size={13} />
                External AI assisted
              </span>
            )}
          </div>
        </div>

        {/* Footer safety guarantee */}
        <p className="scanner-guarantee">
          <Icon name="shield" size={13} />
          ScamBreak performs defensive inspection. Private evidence is never published automatically.
        </p>
      </div>
    </div>
  );
}
