import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  adminApi,
  analysisApi,
  ApiError,
  canUseLocalFallback,
  intelligenceApi,
  localFallbackAllowed,
  moderationApi,
  urlAnalysisApi,
} from './api/client';
import { AppShell } from './components/AppShell';
import { AnalysisScanner } from './components/AnalysisScanner';
import { Icon, LogoMark } from './components/Icon';
import { ThemeToggle } from './components/ThemeToggle';
import { createLocalDemoAnalysis, createLocalResponsePlan } from './lib/demoAnalysis';
import { formatDate, riskLabel, severityLabel } from './lib/format';
import { newClientId } from './lib/ids';
import { useAnalysisStore } from './state/AnalysisStore';
import { useAuth } from './state/AuthContext';
import type {
  AbuseReportSummary,
  AdminOverviewStats,
  AnalysisResult,
  AuditLogEntry,
  CommunitySignalKind,
  CommunityReport,
  EvidenceChannel,
  EvidenceInput,
  EvidenceKind,
  IncidentInteraction,
  IncidentRecord,
  MyCommunityReport,
  PendingCommunityReport,
  RecommendedAction,
  ScamPatternSummary,
  TrustedEntitySummary,
  UrlInspectionResult,
} from './types/analysis';

const evidenceOptions: Array<{ kind: EvidenceKind; label: string; detail: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { kind: 'text', label: 'Message or chat', detail: 'Paste a suspicious SMS, chat, social message, or call transcript.', icon: 'document' },
  { kind: 'url', label: 'Link or domain', detail: 'Inspect a URL without opening it in your browser.', icon: 'link' },
  { kind: 'image', label: 'Screenshot', detail: 'Add a JPEG, PNG, or WebP screenshot from the conversation.', icon: 'image' },
  { kind: 'structured', label: 'Key details', detail: 'Capture a sender, payment request, deadline, or claim.', icon: 'file' },
];

const interactionOptions: Array<{ id: IncidentInteraction; label: string; detail: string }> = [
  { id: 'clicked_link', label: 'Opened a link', detail: 'I visited a link from the message.' },
  { id: 'entered_password', label: 'Entered a password', detail: 'I typed a password, passcode, or recovery information.' },
  { id: 'shared_otp', label: 'Shared a one-time code', detail: 'I gave an OTP, PIN, verification, or recovery code.' },
  { id: 'installed_app', label: 'Installed an app', detail: 'I installed software requested by the sender.' },
  { id: 'shared_screen', label: 'Shared my screen', detail: 'I gave someone screen-sharing or remote access.' },
  { id: 'sent_money', label: 'Sent money', detail: 'I made a payment or approved a transfer.' },
  { id: 'shared_financial_details', label: 'Shared bank or card details', detail: 'I provided payment or account information.' },
  { id: 'shared_identity_document', label: 'Shared identity documents', detail: 'I sent an ID, proof of address, or similar document.' },
  { id: 'contacted_sender', label: 'Replied or called', detail: 'I contacted the person but did not take another action.' },
];

function riskClass(level: string): string {
  return `risk-${level}`;
}

function priorityLabel(priority: RecommendedAction['priority']): string {
  if (priority === 'immediate' || priority === 'do_now') return 'Do now';
  if (priority === 'today') return 'Today';
  if (priority === 'monitor') return 'Keep an eye on it';
  return 'Next';
}

function LoadingBlock({ label = 'Loading securely…' }: { label?: string }) {
  return <div className="loading-block" role="status"><span className="spinner" />{label}</div>;
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'danger' | 'success' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;
}

function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <header className="page-header">
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    {children}
  </header>;
}

function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="brand" aria-label="ScamBreak home"><LogoMark size={28} /><span>Scam<span>Break</span></span></Link>
        <div className="landing-links">
          <ThemeToggle />
          <a href="#how-it-works">How it works</a>
          <Link to="/auth">{user ? 'Account' : 'Sign in'}</Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" />Defensive analysis, not a chatbot verdict</p>
            <h1>Pause. Inspect. Act safely.</h1>
            <p className="hero-lede">ScamBreak turns suspicious messages, links, screenshots, and payment requests into clear evidence, explainable risk signals, and safe next steps.</p>
            <div className="hero-actions">
              <Link className="button button-primary" to={user ? '/analyze' : '/auth'}>Start a private analysis <Icon name="arrow-right" size={18} /></Link>
              <a className="button button-secondary" href="#how-it-works">See what we check</a>
            </div>
            <p className="fine-print"><Icon name="lock" size={15} /> Private evidence is never published automatically. No result proves a message is legitimate.</p>
          </div>
          <div className="hero-panel" aria-label="Example analysis summary">
            <div className="panel-topline"><span>Analysis summary</span><span className="mini-pill critical">High risk</span></div>
            <div className="signal-stack">
              <div className="signal-row"><span className="signal-icon"><Icon name="triangle" size={17} /></span><div><strong>Pressure to act quickly</strong><span>A deadline was detected in the message.</span></div></div>
              <div className="signal-row"><span className="signal-icon"><Icon name="lock" size={17} /></span><div><strong>Credential request</strong><span>The sender asks for a one-time code.</span></div></div>
              <div className="signal-row"><span className="signal-icon"><Icon name="link" size={17} /></span><div><strong>Link needs verification</strong><span>Use an official app or address you find yourself.</span></div></div>
            </div>
            <div className="panel-action"><Icon name="shield" size={18} />Do not click, pay, or share a code before verifying independently.</div>
          </div>
        </section>
        <section id="how-it-works" className="loop-section">
          <div className="section-intro"><p className="eyebrow">The ScamBreak method</p><h2>Evidence first. Explanations always.</h2><p>Every analysis separates what was submitted, what was detected, what could be independently checked, and what still needs verification.</p></div>
          <div className="loop-grid">
            {[
              ['01', 'Submit evidence', 'Messages, URLs, screenshots, copied emails, and key details can be grouped in one private case.'],
              ['02', 'Extract signals', 'ScamBreak normalizes entities and runs independent pressure, payment, credential, impersonation, and URL checks.'],
              ['03', 'Understand risk', 'A deterministic, configurable scoring layer explains the risk level. It is not a fabricated probability.'],
              ['04', 'Verify and act', 'Get safe ways to verify a claim and a prioritized response plan if you already interacted.'],
            ].map(([number, title, detail]) => <article className="loop-card" key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}
          </div>
        </section>
        <section className="principles-strip">
          <div><Icon name="eye" /><strong>Explainable</strong><span>Findings link to evidence.</span></div>
          <div><Icon name="lock" /><strong>Private by default</strong><span>Evidence stays under your account.</span></div>
          <div><Icon name="shield" /><strong>Defensive only</strong><span>We never navigate suspicious links for you.</span></div>
        </section>
      </main>
      <footer className="landing-footer">ScamBreak provides defensive guidance, not legal, financial, or law-enforcement services.</footer>
    </div>
  );
}

function AuthPage() {
  const { user, signIn, register, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'sign-in' | 'create'>('create');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const next = (location.state as { from?: string } | null)?.from ?? '/analyze';

  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, navigate, next]);
  if (isLoading) return <div className="auth-screen"><LoadingBlock /></div>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(undefined);
    try {
      if (mode === 'create') await register({ displayName, email, password });
      else await signIn({ email, password });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not complete that request safely.');
    } finally { setSaving(false); }
  };

  return <div className="auth-screen">
    <Link className="brand auth-brand" to="/"><LogoMark size={28} /><span>Scam<span>Break</span></span></Link>
    <section className="auth-card">
      <p className="eyebrow">Private workspace</p>
      <h1>{mode === 'create' ? 'Protect your analyses' : 'Welcome back'}</h1>
      <p>Evidence and results are private to your account. We use an HttpOnly session cookie, never a browser storage token.</p>
      {error && <Notice tone="danger">{error}</Notice>}
      <form onSubmit={submit} className="form-stack">
        {mode === 'create' && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} autoComplete="name" required /></label>}
        <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={mode === 'create' ? 12 : 1} maxLength={128} required /></label>
        {mode === 'create' && <p className="field-help">Use at least 12 characters. Choose a password you do not reuse elsewhere.</p>}
        <button className="button button-primary full-width" disabled={saving}>{saving ? 'Securing your workspace…' : mode === 'create' ? 'Create private account' : 'Sign in securely'} <Icon name="arrow-right" size={18} /></button>
      </form>
      <button className="text-button" type="button" onClick={() => { setMode(mode === 'create' ? 'sign-in' : 'create'); setError(undefined); }}>
        {mode === 'create' ? 'Already have an account? Sign in' : 'Need a private account? Create one'}
      </button>
    </section>
  </div>;
}

function Workspace({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="auth-screen"><LoadingBlock /></div>;
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  return <AppShell>{children}</AppShell>;
}

function AnalyzePage() {
  const navigate = useNavigate();
  const { saveLocalAnalysis } = useAnalysisStore();
  const [kind, setKind] = useState<EvidenceKind>('text');
  const [channel, setChannel] = useState<EvidenceChannel>('sms');
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File>();
  const [fields, setFields] = useState({ claimedOrganization: '', sender: '', paymentDestination: '', amount: '', deadline: '', requestedAction: '' });
  const [evidence, setEvidence] = useState<EvidenceInput[]>([]);
  const [allowAi, setAllowAi] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const addEvidence = () => {
    const content = draft.trim();
    if (kind === 'image' && !file) { setError('Choose a JPEG, PNG, or WebP screenshot before adding it.'); return; }
    if (kind !== 'image' && kind !== 'structured' && !content) { setError('Add the content you want ScamBreak to inspect.'); return; }
    if (kind === 'structured' && !Object.values(fields).some((value) => value.trim())) { setError('Add at least one detail before adding it.'); return; }
    if (kind === 'image' && file && file.size > 10 * 1024 * 1024) { setError('Screenshots must be 10 MB or smaller.'); return; }
    setEvidence((items) => [...items, {
      clientId: newClientId('evidence'), kind, channel, content: content || undefined, file, originalFilename: file?.name,
      metadata: kind === 'structured' ? Object.fromEntries(Object.entries(fields).filter(([, value]) => value.trim())) : undefined,
    }]);
    setDraft(''); setFile(undefined); setFields({ claimedOrganization: '', sender: '', paymentDestination: '', amount: '', deadline: '', requestedAction: '' }); setError(undefined);
  };

  const removeEvidence = (id: string) => setEvidence((items) => items.filter((item) => item.clientId !== id));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (evidence.length === 0) { setError('Add at least one piece of evidence before starting the analysis.'); return; }
    setSubmitting(true); setError(undefined);
    const payload = { title: title.trim() || undefined, evidence, allowExternalAiProcessing: allowAi };
    try {
      const [result] = await Promise.all([
        analysisApi.create(payload),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      navigate(`/analyses/${result.publicId}`);
    } catch (reason) {
      if (canUseLocalFallback(reason)) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const preview = createLocalDemoAnalysis(payload);
        saveLocalAnalysis(preview);
        navigate(`/analyses/${preview.publicId}`);
      } else {
        setError(reason instanceof Error ? reason.message : 'The analysis could not be completed safely.');
      }
    } finally { setSubmitting(false); }
  };

  const switchKind = (newKind: EvidenceKind) => {
    setKind(newKind);
    setError(undefined);
    if (newKind === 'url') setChannel('website');
    else if (newKind === 'email') setChannel('email');
    else setChannel('sms');
  };

  return <div className="page analyze-page">
    {submitting && (
      <AnalysisScanner
        evidenceCount={evidence.length}
        caseTitle={title.trim() || undefined}
        allowAi={allowAi}
      />
    )}
    <PageHeader eyebrow="Private analysis workspace" title="Check before you act"><p>Group related evidence. ScamBreak will identify structured signals, explain its risk assessment, and suggest safe verification steps.</p></PageHeader>
    <div className="investigation-banner"><Icon name="shield" size={21} /><div><strong>What we check</strong><span>Pressure, impersonation, credential and payment requests, suspicious URLs, common scam patterns, and evidence limits.</span></div><div className="banner-privacy"><Icon name="lock" size={16} />Private by default</div></div>
    {error && <Notice tone="danger">{error}</Notice>}
    <form onSubmit={submit} className="analysis-layout">
      <section className="evidence-workbench card">
        <div className="card-heading"><div><p className="eyebrow">1 — Add evidence</p><h2>Build a small case file</h2></div><span className="counter">{evidence.length}/20</span></div>
        <label className="title-input"><span>Optional case name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Delivery text received today" /></label>
        <div className="evidence-tabs" role="tablist" aria-label="Evidence type">
          {evidenceOptions.map((option) => <button key={option.kind} type="button" className={kind === option.kind ? 'active' : ''} onClick={() => switchKind(option.kind)} role="tab" aria-selected={kind === option.kind}><Icon name={option.icon} size={17} />{option.label}</button>)}
        </div>
        <div className="channel-picker">
          <label htmlFor="channel-select">Channel received on:</label>
          <select id="channel-select" value={channel} onChange={(e) => setChannel(e.target.value as EvidenceChannel)}>
            <option value="sms">SMS / Text</option>
            <option value="chat">Chat / Messaging app</option>
            <option value="email">Email</option>
            <option value="social_media">Social media</option>
            <option value="marketplace">Marketplace</option>
            <option value="phone_call">Phone call</option>
            <option value="website">Website / Link</option>
            <option value="unknown">Unspecified</option>
          </select>
        </div>
        <div className="evidence-entry">
          {kind === 'text' && <label><span>Suspicious message or transcript</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={50_000} placeholder="Paste the message exactly as you received it. Do not include your own password, OTP, PIN, or card number." rows={9} /><small>{draft.length.toLocaleString()} / 50,000 characters</small></label>}
          {kind === 'url' && <label><span>Link or domain</span><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4_096} inputMode="url" placeholder="https://example.com/verify or example.com" /><small>ScamBreak inspects the address defensively; it does not open the link in your browser.</small></label>}
          {kind === 'image' && <label className="upload-drop"><Icon name="image" size={28} /><span>Choose a screenshot</span><small>JPEG, PNG, or WebP · maximum 10 MB · evidence stays private</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0])} />{file && <strong>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</strong>}</label>}
          {kind === 'structured' && <div className="structured-grid">
            {[
              ['claimedOrganization', 'Claimed organization'], ['sender', 'Sender / contact'], ['paymentDestination', 'Payment destination'], ['amount', 'Amount / currency'], ['deadline', 'Deadline'], ['requestedAction', 'What are they asking you to do?'],
            ].map(([key, label]) => <label key={key}><span>{label}</span><input value={fields[key as keyof typeof fields]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} maxLength={300} /></label>)}
          </div>}
        </div>
        <button type="button" className="button button-secondary add-evidence" onClick={addEvidence}><Icon name="plus" size={17} />Add to analysis</button>
      </section>
      <aside className="case-sidebar">
        <section className="card case-card"><div className="card-heading"><div><p className="eyebrow">2 — Review</p><h2>Your evidence</h2></div></div>
          {evidence.length === 0 ? <div className="empty-case"><Icon name="file" size={26} /><p>No evidence added yet.</p><span>Add one or more related items to compare them together.</span></div> : <ul className="evidence-list">{evidence.map((item) => <li key={item.clientId}><span className="evidence-kind"><Icon name={evidenceOptions.find((option) => option.kind === item.kind)?.icon ?? 'file'} size={16} /></span><div><strong>{evidenceOptions.find((option) => option.kind === item.kind)?.label}</strong><span>{item.kind === 'image' ? item.originalFilename : item.kind === 'structured' ? 'Manual details' : `${item.content?.slice(0, 56) ?? ''}${(item.content?.length ?? 0) > 56 ? '…' : ''}`}</span></div><button type="button" aria-label="Remove evidence" onClick={() => removeEvidence(item.clientId)}><Icon name="trash" size={16} /></button></li>)}</ul>}
        </section>
        <section className="privacy-card"><Icon name="lock" size={19} /><div><strong>External AI is off by default</strong><p>Enable it only if you consent to sending normalized evidence to a configured provider. Deterministic checks always run.</p><label className="toggle"><input type="checkbox" checked={allowAi} onChange={(event) => setAllowAi(event.target.checked)} /><span />Allow external AI processing</label></div></section>
        <button className="button button-primary full-width analyze-button" type="submit" disabled={submitting || evidence.length === 0}>{submitting ? 'Analyzing evidence…' : 'Analyze evidence'} <Icon name="scan" size={18} /></button>
        <p className="case-disclaimer">A low or unclear risk result is not proof that a sender or claim is legitimate.</p>
      </aside>
    </form>
  </div>;
}

const reportCategories = [
  { value: 'bank_payment_impersonation', label: 'Bank or payment impersonation' },
  { value: 'account_security_warning', label: 'Account, KYC, or security warning' },
  { value: 'delivery_refund', label: 'Delivery, refund, or chargeback' },
  { value: 'job_recruitment', label: 'Job or recruitment' },
  { value: 'investment_crypto', label: 'Investment or crypto' },
  { value: 'marketplace', label: 'Marketplace or buyer/seller' },
  { value: 'romance_social', label: 'Romance or social manipulation' },
  { value: 'tech_support', label: 'Tech support or remote access' },
  { value: 'other_suspicious_interaction', label: 'Other suspicious interaction' },
] as const;

const communitySignalOptions: Array<{ value: CommunitySignalKind; label: string; detail: string }> = [
  { value: 'domain', label: 'Domain', detail: 'A reviewed domain may be shown only after moderation.' },
  { value: 'phone', label: 'Phone number', detail: 'Kept internal and hashed; never published in the feed.' },
  { value: 'email', label: 'Email address', detail: 'Kept internal and hashed; never published in the feed.' },
  { value: 'payment_handle', label: 'Payment handle', detail: 'Kept internal and hashed; never published in the feed.' },
];

function CommunityReportPrompt({ analysis }: { analysis: AnalysisResult }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState(analysis.patternMatches?.[0]?.id ?? 'other_suspicious_interaction');
  const [occurredOn, setOccurredOn] = useState('');
  const [description, setDescription] = useState('');
  const [sharedKinds, setSharedKinds] = useState<CommunitySignalKind[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  if (analysis.localOnly || user?.privacy?.allowCommunityReportPrompts === false) return null;

  const toggleSignal = (kind: CommunitySignalKind) => {
    setSharedKinds((items) => items.includes(kind) ? items.filter((item) => item !== kind) : [...items, kind]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await intelligenceApi.createCommunityReport({
        analysisId: analysis.publicId,
        category,
        ...(analysis.patternMatches?.[0]?.id ? { patternId: analysis.patternMatches[0].id } : {}),
        ...(occurredOn ? { occurredOn } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        shareSignalKinds: sharedKinds,
      });
      setMessage('Your report is private and pending moderation. No screenshot, raw message, payment detail, or personal identifier was published.');
      setIsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report could not be submitted safely.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="card community-report-prompt">
    <div className="community-report-heading">
      <div><p className="eyebrow">Optional community intelligence</p><h2>Help identify recurring patterns</h2></div>
      <Icon name="flag" size={22} />
    </div>
    <p>Submit a separate, moderated report without publishing your evidence. This is not a way to accuse a person or organization publicly.</p>
    {message && <Notice tone="success">{message}</Notice>}
    {error && <Notice tone="danger">{error}</Notice>}
    {!isOpen ? <button className="button button-secondary" type="button" onClick={() => { setIsOpen(true); setError(undefined); }}><Icon name="flag" size={16} />Create a private report</button> : <form className="community-report-form" onSubmit={submit}>
      <Notice tone="info"><Icon name="lock" size={16} />Raw evidence is never copied into this report. Signal sharing is optional and each choice is explicit.</Notice>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{reportCategories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Approximate date <span className="optional">optional</span><input type="date" value={occurredOn} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setOccurredOn(event.target.value)} /></label>
      <fieldset className="signal-sharing"><legend>Optional normalized signals</legend><p>Only select a signal if you want ScamBreak to use it for internal, privacy-preserving campaign matching.</p>{communitySignalOptions.map((option) => <label key={option.value} className="share-signal"><input type="checkbox" checked={sharedKinds.includes(option.value)} onChange={() => toggleSignal(option.value)} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</fieldset>
      <label>Private context for a moderator <span className="optional">optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1_500} rows={4} placeholder="Brief factual context only. Do not include names, passwords, OTPs, full account numbers, or other sensitive details." /></label>
      <div className="inline-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Submitting safely…' : 'Submit for moderation'} <Icon name="send" size={16} /></button><button className="text-button" type="button" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</button></div>
    </form>}
  </section>;
}

function AnalysisResultPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const { getLocalAnalysis } = useAnalysisStore();
  const [analysis, setAnalysis] = useState<AnalysisResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    let active = true;
    const local = analysisId ? getLocalAnalysis(analysisId) : undefined;
    if (local) { setAnalysis(local); setLoading(false); return; }
    if (!analysisId) { setError('That analysis identifier is missing.'); setLoading(false); return; }
    analysisApi.get(analysisId).then((result) => { if (active) setAnalysis(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'This analysis could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analysisId, getLocalAnalysis]);

  if (loading) return <div className="page"><LoadingBlock label="Opening private analysis…" /></div>;
  if (!analysis) return <div className="page"><PageHeader eyebrow="Analysis" title="Unable to open this analysis" />{error && <Notice tone="danger">{error}</Notice>}<Link className="button button-secondary" to="/history">Back to history</Link></div>;
  const detected = analysis.findings.filter((finding) => finding.detected);
  const risk = analysis.riskAssessment;
  return <div className="page result-page">
    {analysis.localOnly && <Notice tone="info"><Icon name="info" size={17} />This is a local rule-based preview. It was not saved to your account and did not use external verification.</Notice>}
    <div className="result-heading"><div><p className="eyebrow">Private analysis result</p><h1>{analysis.title ?? 'Suspicious interaction analysis'}</h1><p>Created {formatDate(analysis.createdAt)} · {analysis.evidence.length} evidence item{analysis.evidence.length === 1 ? '' : 's'}</p></div><Link className="button button-secondary" to="/analyze"><Icon name="plus" size={17} />New analysis</Link></div>
    <section className={`verdict-card ${riskClass(risk.level)}`}><div className="verdict-label"><Icon name={risk.level === 'low' ? 'info' : 'triangle'} size={23} /><span>Risk level</span></div><div className="verdict-main"><h2>{riskLabel(risk.level)}</h2><p>{risk.level === 'unclear' ? 'There is not enough decisive evidence to classify this interaction safely.' : 'This level reflects detected signals, not a probability or a claim of certainty.'}</p></div><div className="score-block"><span>Indicator score</span><strong>{risk.score ?? '—'}</strong><small>Confidence: {risk.confidence}</small></div></section>
    <div className="result-grid">
      <div className="result-main">
        <section className="card"><div className="card-heading"><div><p className="eyebrow">What was detected</p><h2>Why this needs attention</h2></div><span className="counter">{detected.length} signals</span></div>
          {detected.length === 0 ? <div className="empty-findings"><Icon name="info" size={22} /><p>No decisive rule was triggered by the available evidence.</p><span>That does not establish legitimacy. Use the verification steps below before acting.</span></div> : <div className="finding-list">{detected.map((finding) => <article key={finding.id} className="finding"><span className={`severity-dot severity-${finding.severity}`} /><div><div className="finding-topline"><h3>{finding.title}</h3><span className={`mini-pill ${finding.severity}`}>{severityLabel(finding.severity)}</span></div><p>{finding.explanation}</p>{finding.evidence.length > 0 && <ul className="evidence-excerpts">{finding.evidence.map((excerpt, index) => <li key={`${finding.id}-${index}`}><Icon name="eye" size={14} />{excerpt}</li>)}</ul>}</div></article>)}</div>}
        </section>
        {analysis.patternMatches && analysis.patternMatches.length > 0 && (
          <section className="card matched-patterns-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Tactical scam taxonomy</p>
                <h2>Recognized scam patterns</h2>
              </div>
              <span className="counter">{analysis.patternMatches.length} matched</span>
            </div>
            <div className="matched-patterns-list">
              {analysis.patternMatches.map((pattern) => (
                <article key={pattern.id} className="matched-pattern-item">
                  <div className="matched-pattern-topline">
                    <h3>{pattern.name}</h3>
                    <Link className="quiet-link" to="/patterns">View taxonomy</Link>
                  </div>
                  <p>{pattern.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="card verification-card"><div className="card-heading"><div><p className="eyebrow">What to verify</p><h2>Verify through a trusted route</h2></div><Icon name="search" size={22} /></div>
          {analysis.verificationGuidance.length ? <ol className="guidance-list">{analysis.verificationGuidance.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p>{step.warning && <small><Icon name="triangle" size={14} />{step.warning}</small>}</div></li>)}</ol> : <p className="muted">No specific verification path was generated. Do not rely on the sender’s supplied contact details; use an official source you find independently.</p>}
          <div className="card-footer-action">
            <Link className="button button-secondary" to="/verify"><Icon name="search" size={16} />Open trusted organization directory</Link>
          </div>
        </section>
        <CommunityReportPrompt analysis={analysis} />
        <section className="card"><button type="button" className="technical-toggle" onClick={() => setShowTechnical((visible) => !visible)} aria-expanded={showTechnical}><span><Icon name="eye" size={18} />Technical details & limitations</span><Icon name="chevron-down" size={18} /></button>
          {showTechnical && <div className="technical-content"><p><strong>Analysis engine:</strong> {risk.engineVersion}</p><p><strong>Confidence:</strong> {risk.confidence}. Confidence reflects evidence coverage, not an assurance that a claim is true or false.</p><ul>{risk.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </section>
      </div>
      <aside className="result-actions">
        <section className="action-plan"><p className="eyebrow">What to do now</p><h2>Safe action plan</h2>{analysis.recommendedActions.length ? <ol>{analysis.recommendedActions.map((action, index) => <li key={action.id}><span className={`priority ${action.priority}`}>{priorityLabel(action.priority)}</span><div><strong>{action.title}</strong><p>{action.description}</p></div><span className="action-number">{index + 1}</span></li>)}</ol> : <p>Pause before clicking, replying, paying, or sharing information. Verify the claim independently.</p>}<Link className="button button-primary full-width" to={`/incident?analysisId=${encodeURIComponent(analysis.publicId)}`}><Icon name="warning" size={17} />I already interacted</Link></section>
        <section className="card compact-card"><p className="eyebrow">Evidence</p><h2>What was reviewed</h2><ul className="result-evidence">{analysis.evidence.map((item, index) => <li key={`${item.label}-${index}`}><Icon name={evidenceOptions.find((option) => option.kind === item.kind)?.icon ?? 'file'} size={16} /><span>{item.label}</span><small>{item.status === 'unavailable' ? 'Extraction unavailable' : 'Processed'}</small></li>)}</ul></section>
        {analysis.extractedEntities.length > 0 && <section className="card compact-card"><p className="eyebrow">Extracted signals</p><h2>Normalized entities</h2><div className="entity-tags">{analysis.extractedEntities.slice(0, 16).map((entity, index) => <span key={`${entity.type}-${index}`} title={entity.type}>{entity.value}</span>)}</div><p className="field-help">Sensitive identifiers are redacted in this view.</p></section>}
      </aside>
    </div>
    <div className="result-bottom-actions"><Link className="quiet-link" to="/history"><Icon name="history" size={17} />View private history</Link><button className="text-button" type="button" onClick={() => navigate('/analyze')}>Analyze another item</button></div>
  </div>;
}

function IncidentPage() {
  const [searchParams] = useSearchParams();
  const linkedAnalysisId = searchParams.get('analysisId') ?? undefined;
  const [selected, setSelected] = useState<IncidentInteraction[]>([]);
  const [notes, setNotes] = useState('');
  const [plan, setPlan] = useState<RecommendedAction[]>();
  const [pastIncidents, setPastIncidents] = useState<IncidentRecord[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    analysisApi.listIncidents().then((items) => {
      if (active) setPastIncidents(items);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const add = (id: IncidentInteraction) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected.length) { setError('Choose what happened so ScamBreak can prioritize the response plan.'); return; }
    setSaving(true); setError(undefined);
    try {
      const incident = await analysisApi.createIncident(selected, notes, linkedAnalysisId);
      setPlan(incident.responsePlan);
      const updated = await analysisApi.listIncidents();
      setPastIncidents(updated);
    } catch (reason) {
      if (canUseLocalFallback(reason)) {
        const localPlan = createLocalResponsePlan(selected);
        setPlan(localPlan);
        const localRecord: IncidentRecord = {
          id: newClientId('inc'),
          interactions: selected,
          status: 'open',
          createdAt: new Date().toISOString(),
        };
        setPastIncidents((items) => [localRecord, ...items]);
      } else {
        setError(reason instanceof Error ? reason.message : 'The incident response plan could not be created.');
      }
    } finally { setSaving(false); }
  };

  return <div className="page incident-page">
    <PageHeader eyebrow="Incident response" title="If you already interacted, act in the right order">
      <p>ScamBreak cannot reverse a transaction or recover an account. It can help you organize immediate protective steps and preserve useful evidence.</p>
    </PageHeader>
    {linkedAnalysisId && (
      <div className="notice notice-info">
        <Icon name="link" size={17} />
        <div>
          <strong>Linked to Analysis:</strong> {linkedAnalysisId}. This incident response plan is associated with your private analysis file.
        </div>
      </div>
    )}
    <Notice tone="danger"><Icon name="triangle" size={18} /><strong>Urgent:</strong>&nbsp; If you shared a one-time code, password, payment information, or remote access, contact the affected bank, payment provider, or account provider through its official app or a trusted number now.</Notice>
    <div className="incident-layout">
      <form className="card incident-form" onSubmit={submit}>
        <div className="card-heading"><div><p className="eyebrow">What happened?</p><h2>Select everything that applies</h2></div></div>
        <div className="interaction-grid">{interactionOptions.map((option) => <label key={option.id} className={`interaction-option ${selected.includes(option.id) ? 'selected' : ''}`}><input type="checkbox" checked={selected.includes(option.id)} onChange={() => add(option.id)} /><span className="checkbox-mark"><Icon name="check" size={15} /></span><div><strong>{option.label}</strong><small>{option.detail}</small></div></label>)}</div>
        <label className="notes-field"><span>Optional notes for your private record</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2_000} placeholder="Do not paste passwords, OTPs, full card numbers, or other access credentials." rows={4} /></label>
        {error && <Notice tone="danger">{error}</Notice>}
        <button className="button button-primary" disabled={saving}>{saving ? 'Preparing plan…' : 'Create response plan'} <Icon name="arrow-right" size={17} /></button>
      </form>
      <aside className="incident-guide"><Icon name="shield" size={25} /><p className="eyebrow">First principles</p><h2>Protect access before investigating</h2><ol><li>Stop communicating with the sender.</li><li>Use a different, trusted device for important account changes if remote access was involved.</li><li>Contact the affected provider independently.</li><li>Save receipts, timestamps, and screenshots before blocking or deleting.</li></ol></aside>
    </div>
    {plan && <section className="card incident-plan"><p className="eyebrow">Prioritized response plan</p><h2>Start here</h2><ol>{plan.map((action, index) => <li key={action.id ?? index}><span>{index + 1}</span><div><strong>{action.title}</strong><p>{action.description}</p></div><em>{priorityLabel(action.priority)}</em></li>)}</ol></section>}
    {pastIncidents.length > 0 && (
      <section className="card incident-history-section">
        <div className="card-heading">
          <div><p className="eyebrow">Previous incident records</p><h2>Past response plans</h2></div>
          <span className="counter">{pastIncidents.length} record{pastIncidents.length === 1 ? '' : 's'}</span>
        </div>
        <div className="incident-history-list">
          {pastIncidents.map((record) => (
            <div key={record.id} className="incident-history-card">
              <div>
                <strong>Incident #{record.id}</strong>
                <p className="incident-record-meta">Created {formatDate(record.createdAt)}</p>
                <div className="incident-history-interactions">
                  {record.interactions.map((interaction) => (
                    <span key={interaction} className="incident-history-interaction">
                      {interaction.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`badge-status badge-${record.status === 'open' ? 'pending' : 'published'}`}>
                {record.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    )}
  </div>;
}

function HistoryPage() {
  const { localAnalyses, forgetLocalAnalysis } = useAnalysisStore();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<string>();

  useEffect(() => {
    let active = true;
    analysisApi.list().then((page) => {
      if (active) {
        setAnalyses(page.items);
        setNextCursor(page.nextCursor);
      }
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Your analysis history could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const items = useMemo(() => [...localAnalyses, ...analyses.filter((analysis) => !localAnalyses.some((local) => local.publicId === analysis.publicId))], [localAnalyses, analyses]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await analysisApi.list(nextCursor);
      setAnalyses((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load older analyses.');
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (analysis: AnalysisResult) => {
    if (!window.confirm('Delete this private analysis and its stored evidence? This cannot be undone.')) return;
    setDeleting(analysis.publicId);
    try {
      if (analysis.localOnly) forgetLocalAnalysis(analysis.publicId);
      else {
        await analysisApi.remove(analysis.publicId);
        setAnalyses((list) => list.filter((item) => item.publicId !== analysis.publicId));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The analysis could not be deleted.');
    } finally {
      setDeleting(undefined);
    }
  };

  return <div className="page">
    <PageHeader eyebrow="Private history" title="Your analyses">
      <p>Only you can open this history. Deleting an analysis removes its evidence and analysis records from your account.</p>
    </PageHeader>
    {error && <Notice tone="danger">{error}</Notice>}
    {loading ? <LoadingBlock label="Loading private history…" /> : items.length === 0 ? (
      <section className="empty-state card">
        <Icon name="history" size={30} />
        <h2>No saved analyses yet</h2>
        <p>Start with a suspicious message, link, or screenshot whenever you want a second look.</p>
        <Link className="button button-primary" to="/analyze">Analyze something <Icon name="arrow-right" size={17} /></Link>
      </section>
    ) : (
      <>
        <div className="history-list">
          {items.map((analysis) => (
            <article className="history-card" key={analysis.publicId}>
              <div className={`history-risk ${riskClass(analysis.riskAssessment.level)}`}>
                {riskLabel(analysis.riskAssessment.level)}
              </div>
              <div className="history-copy">
                <h2>{analysis.title ?? 'Untitled analysis'}</h2>
                <p>{formatDate(analysis.createdAt)} · {analysis.localOnly ? 'Local preview (not saved)' : 'Private account record'}</p>
              </div>
              <div className="history-actions">
                <Link className="button button-secondary" to={`/analyses/${analysis.publicId}`}>Open</Link>
                <button type="button" className="icon-button danger" aria-label="Delete analysis" disabled={deleting === analysis.publicId} onClick={() => void remove(analysis)}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {nextCursor && (
          <div className="load-more-wrap">
            <button className="button button-secondary" type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading older analyses…' : 'Load older analyses'}
            </button>
          </div>
        )}
      </>
    )}
  </div>;
}

const patternFallback: ScamPatternSummary[] = [
  { id: 'bank_payment_impersonation', category: 'Bank & payments', name: 'Bank or payment-provider impersonation', description: 'A claimed financial organization uses pressure, a link, payment request, or credential request.', severity: 'high', applicableChannels: ['SMS', 'email', 'chat'], aliases: ['account blocked', 'bank alert'], version: '1.0.0' },
  { id: 'job_recruitment_advance_fee', category: 'Jobs', name: 'Recruitment advance fee', description: 'A job offer asks for a registration, training, equipment, or deposit payment before employment.', severity: 'high', applicableChannels: ['email', 'chat'], aliases: ['work from home fee'], version: '1.0.0' },
  { id: 'tech_support_remote_access', category: 'Tech support', name: 'Remote-access attempt', description: 'A claimed support interaction asks you to install software or share your screen.', severity: 'critical', applicableChannels: ['call', 'chat'], aliases: ['AnyDesk', 'screen share'], version: '1.0.0' },
];

function CommunityPage() {
  const [tab, setTab] = useState<'public' | 'mine'>('public');
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [myReports, setMyReports] = useState<MyCommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [abuseTarget, setAbuseTarget] = useState<CommunityReport | null>(null);
  const [abuseReason, setAbuseReason] = useState('inappropriate_content');
  const [abuseDetail, setAbuseDetail] = useState('');
  const [abuseSaving, setAbuseSaving] = useState(false);
  const [abuseNotice, setAbuseNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    if (tab === 'public') {
      intelligenceApi.community().then((items) => {
        if (active) setReports(items);
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Community intelligence is unavailable right now.');
      }).finally(() => {
        if (active) setLoading(false);
      });
    } else {
      intelligenceApi.myCommunityReports().then((items) => {
        if (active) setMyReports(items);
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Your submitted reports could not be loaded.');
      }).finally(() => {
        if (active) setLoading(false);
      });
    }
    return () => { active = false; };
  }, [tab]);

  const submitAbuse = async (event: FormEvent) => {
    event.preventDefault();
    if (!abuseTarget) return;
    setAbuseSaving(true);
    try {
      await intelligenceApi.submitAbuseReport(abuseTarget.id, abuseReason, abuseDetail);
      setAbuseNotice('Your concern was submitted securely to the moderation team.');
      setAbuseTarget(null);
      setAbuseDetail('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit abuse report.');
    } finally {
      setAbuseSaving(false);
    }
  };

  return <div className="page">
    <PageHeader eyebrow="Community intelligence" title="Patterns, not accusations">
      <p>Community information is opt-in, anonymized, and moderated. ScamBreak never publishes screenshots, raw messages, payment information, or private analysis evidence automatically.</p>
    </PageHeader>
    <div className="subnav-tabs">
      <button className={`subnav-tab ${tab === 'public' ? 'active' : ''}`} type="button" onClick={() => setTab('public')}>
        Public Intelligence
      </button>
      <button className={`subnav-tab ${tab === 'mine' ? 'active' : ''}`} type="button" onClick={() => setTab('mine')}>
        My Submitted Reports
      </button>
    </div>
    <section className="community-principles">
      <div><Icon name="lock" size={20} /><strong>Private stays private</strong><p>Reports are separate from your analysis.</p></div>
      <div><Icon name="shield" size={20} /><strong>Moderated before publication</strong><p>Community summaries are reviewed for safety and fairness.</p></div>
      <div><Icon name="flag" size={20} /><strong>Not a public accusation tool</strong><p>Use official reporting pathways for urgent concerns.</p></div>
    </section>
    {abuseNotice && <Notice tone="success">{abuseNotice}</Notice>}
    {error && <Notice tone="info">{error}</Notice>}
    {loading ? (
      <LoadingBlock label="Loading intelligence…" />
    ) : tab === 'public' ? (
      reports.length === 0 ? (
        <section className="empty-state card">
          <Icon name="globe" size={30} />
          <h2>No moderated reports to show yet</h2>
          <p>That does not mean a current message is safe. Analyze the evidence you have and verify claims independently.</p>
          <Link className="button button-secondary" to="/analyze">Analyze evidence</Link>
        </section>
      ) : (
        <div className="community-grid">
          {reports.map((report) => (
            <article className="community-card" key={report.id}>
              <div className="community-card-topline">
                <span className="mini-pill medium">{report.category.replace(/_/g, ' ')}</span>
                <button type="button" className="text-button community-flag-btn" onClick={() => setAbuseTarget(report)}>
                  Report concern
                </button>
              </div>
              <h2>{report.summary}</h2>
              <p>Published {formatDate(report.publishedAt)}</p>
              {report.sharedDomains.length > 0 && (
                <div className="domain-list"><Icon name="link" size={15} />{report.sharedDomains.join(', ')}</div>
              )}
              <small>Moderated aggregate information — not a determination about any person.</small>
            </article>
          ))}
        </div>
      )
    ) : (
      myReports.length === 0 ? (
        <section className="empty-state card">
          <Icon name="flag" size={30} />
          <h2>No submitted reports yet</h2>
          <p>When you finish an analysis, you can choose to submit an optional, anonymized pattern report for moderation.</p>
          <Link className="button button-primary" to="/analyze">Start an analysis</Link>
        </section>
      ) : (
        <div className="history-list">
          {myReports.map((report) => (
            <article className="history-card" key={report.id}>
              <span className={`badge-status badge-${report.moderationStatus}`}>
                {report.moderationStatus}
              </span>
              <div className="history-copy">
                <h2>{report.category.replace(/_/g, ' ')}</h2>
                <p>Submitted {formatDate(report.createdAt)}{report.occurredOn ? ` · occurred ${report.occurredOn}` : ''}</p>
              </div>
              <div className="history-card-status-detail">
                {report.moderationStatus === 'pending' && 'Under review by moderator'}
                {report.moderationStatus === 'published' && 'Included in public intelligence'}
                {report.moderationStatus === 'rejected' && 'Excluded from public directory'}
              </div>
            </article>
          ))}
        </div>
      )
    )}

    {abuseTarget && (
      <div className="modal-backdrop" onClick={() => setAbuseTarget(null)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <h2>Report concern on community summary</h2>
          <p>If this published summary contains sensitive details, misidentifications, or harmful claims, alert the moderation team.</p>
          <form onSubmit={submitAbuse} className="form-stack">
            <label>Reason
              <select value={abuseReason} onChange={(e) => setAbuseReason(e.target.value)}>
                <option value="inappropriate_content">Inappropriate content</option>
                <option value="identifiable_information">Contains personal or identifiable information</option>
                <option value="harassment_defamation">Accusatory or defamatory</option>
                <option value="inaccurate_dangerous_guidance">Inaccurate or misleading advice</option>
                <option value="other">Other safety concern</option>
              </select>
            </label>
            <label>Additional details <span className="optional">optional</span>
              <textarea value={abuseDetail} onChange={(e) => setAbuseDetail(e.target.value)} maxLength={1000} rows={3} placeholder="Provide specific reason for moderation review." />
            </label>
            <div className="inline-actions">
              <button className="button button-primary" type="submit" disabled={abuseSaving}>
                {abuseSaving ? 'Submitting…' : 'Submit report'}
              </button>
              <button className="button button-secondary" type="button" onClick={() => setAbuseTarget(null)} disabled={abuseSaving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>;
}

function PatternsPage() {
  const [patterns, setPatterns] = useState<ScamPatternSummary[]>(patternFallback);
  const [query, setQuery] = useState('');
  useEffect(() => { intelligenceApi.patterns().then((items) => { if (items.length) setPatterns(items); }).catch(() => undefined); }, []);
  const filtered = patterns.filter((pattern) => `${pattern.name} ${pattern.category} ${pattern.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page"><PageHeader eyebrow="Scam pattern library" title="Recognize a tactic without relying on a verdict"><p>This reviewed taxonomy supports consistent, explainable detection. A pattern match is a safety signal, not proof of a sender’s identity or intent.</p></PageHeader><label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patterns, categories, or aliases" /><span>{filtered.length} patterns</span></label><div className="pattern-grid">{filtered.map((pattern) => <article className="pattern-card" key={pattern.id}><div><span className={`mini-pill ${pattern.severity}`}>{severityLabel(pattern.severity)}</span><span className="pattern-category">{pattern.category.replace(/_/g, ' ')}</span></div><h2>{pattern.name}</h2><p>{pattern.description}</p><div className="alias-row">{pattern.aliases.slice(0, 3).map((alias) => <span key={alias}>{alias}</span>)}</div><small>Channels: {pattern.applicableChannels.join(' · ')}</small></article>)}</div></div>;
}

function VerifyPage() {
  const [tab, setTab] = useState<'claim' | 'url' | 'entities'>('claim');

  // Claim check state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<{ status: string; guidance: Array<{ title: string; description: string }> }>();
  const [claimError, setClaimError] = useState<string>();
  const [claimLoading, setClaimLoading] = useState(false);

  // URL inspection state
  const [urlInput, setUrlInput] = useState('');
  const [urlResult, setUrlResult] = useState<UrlInspectionResult>();
  const [urlError, setUrlError] = useState<string>();
  const [urlLoading, setUrlLoading] = useState(false);

  // Trusted entities state
  const [entities, setEntities] = useState<TrustedEntitySummary[]>([]);
  const [entityQuery, setEntityQuery] = useState('');
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);

  useEffect(() => {
    if (tab === 'entities' && !entitiesLoaded) {
      setEntitiesLoading(true);
      intelligenceApi.listEntities().then((data) => {
        setEntities(data);
        setEntitiesLoaded(true);
      }).catch(() => undefined).finally(() => setEntitiesLoading(false));
    }
  }, [tab, entitiesLoaded]);

  const submitClaim = async (event: FormEvent) => {
    event.preventDefault();
    setClaimLoading(true); setClaimError(undefined);
    try {
      setResult(await intelligenceApi.verifyEntity(name, domain || undefined));
    } catch (reason) {
      setClaimError(reason instanceof Error ? reason.message : 'The claim could not be checked.');
    } finally {
      setClaimLoading(false);
    }
  };

  const submitUrl = async (event: FormEvent) => {
    event.preventDefault();
    if (!urlInput.trim()) return;
    setUrlLoading(true); setUrlError(undefined);
    try {
      const res = await urlAnalysisApi.inspect(urlInput.trim());
      setUrlResult(res);
    } catch (reason) {
      setUrlError(reason instanceof Error ? reason.message : 'URL inspection could not be completed.');
    } finally {
      setUrlLoading(false);
    }
  };

  const filteredEntities = useMemo(() => {
    const q = entityQuery.toLowerCase().trim();
    if (!q) return entities;
    return entities.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.aliases.some((a) => a.toLowerCase().includes(q)) ||
      e.officialDomains.some((d) => d.toLowerCase().includes(q))
    );
  }, [entities, entityQuery]);

  return <div className="page">
    <PageHeader eyebrow="Trusted entity verification" title="Verify before you trust">
      <p>A familiar brand name or link in a message is never proof. ScamBreak compares claims against verified directories and inspects URLs defensively without opening them.</p>
    </PageHeader>
    <div className="subnav-tabs">
      <button className={`subnav-tab ${tab === 'claim' ? 'active' : ''}`} type="button" onClick={() => setTab('claim')}>
        Verify a Claim
      </button>
      <button className={`subnav-tab ${tab === 'url' ? 'active' : ''}`} type="button" onClick={() => setTab('url')}>
        Defensive URL Inspector
      </button>
      <button className={`subnav-tab ${tab === 'entities' ? 'active' : ''}`} type="button" onClick={() => setTab('entities')}>
        Verified Organizations Directory
      </button>
    </div>

    {tab === 'claim' && (
      <>
        <div className="verify-layout">
          <form className="card form-stack" onSubmit={submitClaim}>
            <label>Organization named in the message
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. PayPal, Chase, USPS" minLength={2} required />
            </label>
            <label>Domain in the message <span className="optional">optional</span>
              <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="e.g. paypal-verify-login.com" />
            </label>
            <button className="button button-primary" disabled={claimLoading}>
              {claimLoading ? 'Checking directory…' : 'Check claim'} <Icon name="search" size={17} />
            </button>
            {claimError && <Notice tone="danger">{claimError}</Notice>}
          </form>
          <aside className="verify-note">
            <Icon name="triangle" size={23} />
            <h2>Never verify by replying to the message</h2>
            <p>Do not use a number, link, QR code, or email address supplied in the suspicious content. Open an official app directly or find the organization’s site independently.</p>
          </aside>
        </div>
        {result && (
          <section className="card verification-result">
            <p className="eyebrow">Directory result</p>
            <h2>{result.status.replace(/_/g, ' ')}</h2>
            <ol className="guidance-list">
              {result.guidance.map((item, index) => (
                <li key={item.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </>
    )}

    {tab === 'url' && (
      <section className="card url-inspector-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Defensive link analysis</p>
            <h2>Inspect address without navigating</h2>
          </div>
          <Icon name="link" size={22} />
        </div>
        <p className="section-description">
          ScamBreak decomposes the URL, checks for IP hosts, homoglyphs, brand lookalikes, private IP ranges, and unusual schemes without opening any browser connection to the site.
        </p>
        <form onSubmit={submitUrl} className="form-stack">
          <label>URL or web address
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://secure-login-chase-update.info/verify" required />
          </label>
          <button className="button button-primary" type="submit" disabled={urlLoading}>
            {urlLoading ? 'Inspecting safely…' : 'Inspect URL'} <Icon name="scan" size={17} />
          </button>
          {urlError && <Notice tone="danger">{urlError}</Notice>}
        </form>
        {urlResult && (
          <div className="url-inspector-result">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Technical structure</p>
                <h3>{urlResult.technicalSummary?.hostname ?? 'Parsed Host'}</h3>
              </div>
              <span className={`mini-pill ${urlResult.technicalSummary?.safeForRemoteLookup ? 'low' : 'critical'}`}>
                {urlResult.technicalSummary?.safeForRemoteLookup ? 'Valid Public Host' : 'Host Needs Caution'}
              </span>
            </div>
            {urlResult.technicalSummary && (
              <div className="url-security-tags">
                <span className="url-security-tag safe">Protocol: {urlResult.technicalSummary.protocol}</span>
                <span className="url-security-tag safe">Hostname: {urlResult.technicalSummary.hostname}</span>
                {urlResult.technicalSummary.safetyIssues.map((issue) => (
                  <span key={issue} className="url-security-tag warning"><Icon name="triangle" size={13} />{issue.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
            <div className="finding-list finding-list-spaced">
              {urlResult.findings.map((f) => (
                <article key={f.id} className="finding">
                  <span className={`severity-dot severity-${f.severity}`} />
                  <div>
                    <div className="finding-topline">
                      <h3>{f.title}</h3>
                      <span className={`mini-pill ${f.severity}`}>{severityLabel(f.severity)}</span>
                    </div>
                    <p>{f.explanation}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    )}

    {tab === 'entities' && (
      <div>
        <label className="search-field">
          <Icon name="search" size={18} />
          <input value={entityQuery} onChange={(e) => setEntityQuery(e.target.value)} placeholder="Search organizations, official domains, or aliases" />
          <span>{filteredEntities.length} entities</span>
        </label>
        {entitiesLoading ? (
          <LoadingBlock label="Loading verified organizations…" />
        ) : filteredEntities.length === 0 ? (
          <section className="empty-state card">
            <Icon name="shield" size={30} />
            <h2>No organizations match your query</h2>
            <p>If you received a message claiming to be from an organization not listed, verify using their official contact channels found through their official app.</p>
          </section>
        ) : (
          <div className="entity-directory-grid">
            {filteredEntities.map((ent) => (
              <article key={ent.id} className="entity-directory-card">
                <div className="entity-card-topline">
                  <span className="pattern-category">{ent.category.replace(/_/g, ' ')}</span>
                  <span className="mini-pill low">Verified Directory</span>
                </div>
                <h3>{ent.name}</h3>
                <div className="entity-directory-domains">
                  {ent.officialDomains.map((dom) => (
                    <span key={dom} className="entity-directory-domain"><Icon name="link" size={12} /> {dom}</span>
                  ))}
                </div>
                {ent.officialSupportChannels && ent.officialSupportChannels.length > 0 && (
                  <div className="entity-directory-channels">
                    {ent.officialSupportChannels.map((ch, idx) => (
                      <span key={idx}><strong>{ch.label || ch.type}:</strong> {ch.value}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    )}
  </div>;
}

function AccountPage() {
  const { user, signOut, updateSettings } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [privacyMessage, setPrivacyMessage] = useState<string>();
  const [retentionDays, setRetentionDays] = useState('90');
  const [allowCommunityPrompts, setAllowCommunityPrompts] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  useEffect(() => {
    if (!user) return;
    setRetentionDays(String(user.privacy?.analysisRetentionDays ?? 90));
    setAllowCommunityPrompts(user.privacy?.allowCommunityReportPrompts ?? true);
  }, [user]);
  const logout = async () => { try { await signOut(); navigate('/'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign out.'); } };
  const savePrivacy = async (event: FormEvent) => {
    event.preventDefault();
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError('Choose a retention period between 1 and 3,650 days.');
      return;
    }
    setSavingPrivacy(true);
    setError(undefined);
    setPrivacyMessage(undefined);
    try {
      await updateSettings({ privacy: { analysisRetentionDays: days, allowCommunityReportPrompts: allowCommunityPrompts } });
      setPrivacyMessage('Your privacy settings were saved. You can still delete any analysis immediately from private history.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your privacy settings could not be saved.');
    } finally {
      setSavingPrivacy(false);
    }
  };
  if (!user) return null;
  return <div className="page"><PageHeader eyebrow="Account & privacy" title="Your private ScamBreak workspace"><p>Control who can access your account, how long private analyses are retained, and whether ScamBreak offers optional community-report prompts.</p></PageHeader>{error && <Notice tone="danger">{error}</Notice>}{privacyMessage && <Notice tone="success">{privacyMessage}</Notice>}<div className="account-grid"><section className="card"><p className="eyebrow">Profile</p><h2>{user.displayName}</h2><p>{user.email}</p><dl className="detail-list"><div><dt>Role</dt><dd>{user.role}</dd></div><div><dt>Session</dt><dd>HttpOnly secure cookie</dd></div><div><dt>Private evidence</dt><dd>Never published automatically</dd></div></dl></section><section className="card privacy-settings-card"><p className="eyebrow">Privacy controls</p><h2>Evidence lifecycle</h2><p>Delete any analysis now from history. The retention period tells ScamBreak when to delete remaining private analysis data through the configured maintenance job.</p><form className="form-stack" onSubmit={savePrivacy}><label>Retention period (days)<input type="number" inputMode="numeric" min="1" max="3650" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} required /></label><label className="privacy-toggle"><input type="checkbox" checked={allowCommunityPrompts} onChange={(event) => setAllowCommunityPrompts(event.target.checked)} /><span /><div><strong>Show optional community report prompts</strong><small>Turning this off never changes existing reports or publishes anything.</small></div></label><button className="button button-secondary" disabled={savingPrivacy}>{savingPrivacy ? 'Saving privacy settings…' : 'Save privacy settings'}</button></form><Link className="quiet-link account-history-link" to="/history"><Icon name="history" size={16} />Manage analysis history</Link></section><section className="card danger-zone"><p className="eyebrow">Session</p><h2>Sign out of this browser</h2><p>Signing out invalidates your current server session. It does not delete your saved analyses.</p><button className="button button-danger" type="button" onClick={() => void logout()}>Sign out</button></section></div></div>;
}

function AdminPage() {
  const { user } = useAuth();
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';
  const isAdmin = user?.role === 'admin';

  type AdminTab = 'moderation' | 'abuse' | 'overview' | 'patterns' | 'entities' | 'audit';
  const [activeTab, setActiveTab] = useState<AdminTab>('moderation');

  // Moderation Queue state
  const [reports, setReports] = useState<PendingCommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [publicSummary, setPublicSummary] = useState('');
  const [moderationNote, setModerationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  // Overview stats state
  const [overviewStats, setOverviewStats] = useState<AdminOverviewStats>();

  // Abuse reports state
  const [abuseReports, setAbuseReports] = useState<AbuseReportSummary[]>([]);

  // Patterns state
  const [adminPatterns, setAdminPatterns] = useState<ScamPatternSummary[]>([]);
  const [patternForm, setPatternForm] = useState({ id: '', name: '', category: 'bank_payment_impersonation', description: '', severity: 'high' as const, applicableChannels: 'sms, email, chat', aliases: '' });

  // Entities state
  const [adminEntities, setAdminEntities] = useState<TrustedEntitySummary[]>([]);
  const [entityForm, setEntityForm] = useState({ name: '', category: 'financial_services', officialDomains: '', aliases: '', supportChannel: '' });

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    let active = true;
    if (!canModerate) { setLoading(false); return () => { active = false; }; }

    if (activeTab === 'moderation') {
      setLoading(true);
      moderationApi.pendingCommunityReports()
        .then((items) => { if (active) setReports(items); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'The moderation queue could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    } else if (activeTab === 'overview' && isAdmin) {
      setLoading(true);
      adminApi.overview()
        .then((data) => { if (active) setOverviewStats(data); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Overview could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    } else if (activeTab === 'abuse' && isAdmin) {
      setLoading(true);
      adminApi.abuseReports()
        .then((data) => { if (active) setAbuseReports(data); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Abuse reports could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    } else if (activeTab === 'patterns' && isAdmin) {
      setLoading(true);
      adminApi.patterns()
        .then((data) => { if (active) setAdminPatterns(data); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Patterns could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    } else if (activeTab === 'entities' && isAdmin) {
      setLoading(true);
      adminApi.entities()
        .then((data) => { if (active) setAdminEntities(data); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Entities could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    } else if (activeTab === 'audit' && isAdmin) {
      setLoading(true);
      adminApi.auditLogs()
        .then((data) => { if (active) setAuditLogs(data); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Audit logs could not be loaded.'); })
        .finally(() => { if (active) setLoading(false); });
    }

    return () => { active = false; };
  }, [activeTab, canModerate, isAdmin]);

  if (!canModerate) return <div className="page"><PageHeader eyebrow="Administration" title="Restricted area" /><Notice tone="danger">Your account does not have access to moderation or administrative tools.</Notice></div>;

  const chooseReport = (report: PendingCommunityReport) => {
    setSelectedId(report.id);
    setPublicSummary('');
    setModerationNote('');
    setError(undefined);
    setMessage(undefined);
  };

  const decide = async (decision: 'published' | 'rejected') => {
    if (!selectedId) return;
    if (decision === 'published' && publicSummary.trim().length < 20) {
      setError('A factual, moderator-authored public summary of at least 20 characters is required before publishing.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await moderationApi.decideCommunityReport({
        reportId: selectedId,
        decision,
        ...(decision === 'published' ? { publicSummary } : {}),
        ...(moderationNote.trim() ? { moderationNote } : {}),
      });
      setReports((items) => items.filter((report) => report.id !== selectedId));
      setSelectedId(undefined);
      setPublicSummary('');
      setModerationNote('');
      setMessage(decision === 'published' ? 'The moderated aggregate report was published.' : 'The report was rejected and remains out of public community intelligence.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The moderation decision could not be saved safely.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePattern = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const payload = {
        id: patternForm.id.trim().toLowerCase().replace(/\s+/g, '_'),
        name: patternForm.name.trim(),
        category: patternForm.category,
        description: patternForm.description.trim(),
        severity: patternForm.severity,
        applicableChannels: patternForm.applicableChannels.split(',').map((s) => s.trim()).filter(Boolean),
        aliases: patternForm.aliases.split(',').map((s) => s.trim()).filter(Boolean),
        version: '1.0.0',
      };
      await adminApi.upsertPattern(payload);
      setMessage(`Pattern "${payload.name}" saved successfully.`);
      const updated = await adminApi.patterns();
      setAdminPatterns(updated);
      setPatternForm({ id: '', name: '', category: 'bank_payment_impersonation', description: '', severity: 'high', applicableChannels: 'sms, email, chat', aliases: '' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save pattern.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEntity = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const payload = {
        name: entityForm.name.trim(),
        category: entityForm.category,
        officialDomains: entityForm.officialDomains.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        aliases: entityForm.aliases.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        verificationStatus: 'verified',
        verificationSource: 'Administrative Verification',
        officialSupportChannels: entityForm.supportChannel.trim() ? [
          { type: 'support_url', label: 'Official Support', value: entityForm.supportChannel.trim(), verified: true }
        ] : [],
      };
      await adminApi.createEntity(payload);
      setMessage(`Verified organization "${payload.name}" added successfully.`);
      const updated = await adminApi.entities();
      setAdminEntities(updated);
      setEntityForm({ name: '', category: 'financial_services', officialDomains: '', aliases: '', supportChannel: '' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to add entity.');
    } finally {
      setSaving(false);
    }
  };

  const selected = reports.find((report) => report.id === selectedId);

  return <div className="page">
    <PageHeader eyebrow="Administration" title="Moderation & system controls">
      <p>Administrative actions are role-protected and audited. Public summaries must be written by a moderator; private evidence and submitter context never become public automatically.</p>
    </PageHeader>

    <div className="subnav-tabs">
      <button className={`subnav-tab ${activeTab === 'moderation' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('moderation'); setError(undefined); setMessage(undefined); }}>
        Moderation Queue
      </button>
      {isAdmin && (
        <>
          <button className={`subnav-tab ${activeTab === 'abuse' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('abuse'); setError(undefined); setMessage(undefined); }}>
            Abuse Reports
          </button>
          <button className={`subnav-tab ${activeTab === 'overview' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('overview'); setError(undefined); setMessage(undefined); }}>
            System Overview
          </button>
          <button className={`subnav-tab ${activeTab === 'patterns' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('patterns'); setError(undefined); setMessage(undefined); }}>
            Pattern Library
          </button>
          <button className={`subnav-tab ${activeTab === 'entities' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('entities'); setError(undefined); setMessage(undefined); }}>
            Trusted Entities
          </button>
          <button className={`subnav-tab ${activeTab === 'audit' ? 'active' : ''}`} type="button" onClick={() => { setActiveTab('audit'); setError(undefined); setMessage(undefined); }}>
            Audit Records
          </button>
        </>
      )}
    </div>

    {message && <Notice tone="success">{message}</Notice>}
    {error && <Notice tone="danger">{error}</Notice>}

    {activeTab === 'moderation' && (
      <section className="card moderation-workbench">
        <div className="card-heading">
          <div><p className="eyebrow">Moderation queue</p><h2>Review private opt-in reports</h2></div>
          <span className="counter">{loading ? '…' : reports.length}</span>
        </div>
        <p className="moderation-intro">Only a report category, selected normalized signal types, and optional moderator context are available here. Do not reconstruct or publish a submitter’s raw message, image, personal data, or allegations.</p>
        {loading ? <LoadingBlock label="Loading moderation queue…" /> : reports.length === 0 ? (
          <div className="moderation-empty"><Icon name="check" size={22} /><strong>No pending reports</strong><span>New opt-in reports will appear here after submission.</span></div>
        ) : (
          <div className="moderation-list">
            {reports.map((report) => (
              <article key={report.id} className={`moderation-item ${selectedId === report.id ? 'selected' : ''}`}>
                <div className="moderation-item-summary">
                  <div>
                    <span className="mini-pill medium">{report.category.replace(/_/g, ' ')}</span>
                    <h3>{report.patternId?.replace(/_/g, ' ') ?? 'No matched pattern selected'}</h3>
                    <p>Submitted {formatDate(report.createdAt)}{report.occurredOn ? ` · occurred about ${report.occurredOn}` : ''}</p>
                    <small>Selected signal types: {report.signalKinds.length ? report.signalKinds.join(', ') : 'none'}</small>
                  </div>
                  <button className="button button-secondary" type="button" onClick={() => chooseReport(report)}>
                    {selectedId === report.id ? 'Reviewing' : 'Review'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {selected && (
          <form className="moderation-decision" onSubmit={(event) => { event.preventDefault(); void decide('published'); }}>
            <div className="moderation-decision-heading">
              <div><p className="eyebrow">Restricted review</p><h3>{selected.category.replace(/_/g, ' ')}</h3></div>
              <button className="text-button" type="button" onClick={() => setSelectedId(undefined)} disabled={saving}>Close</button>
            </div>
            <div className="restricted-context">
              <Icon name="lock" size={17} />
              <div><strong>Private moderator context</strong><p>{selected.privateDescription ?? 'No private description was supplied.'}</p></div>
            </div>
            <label>Moderator-authored public summary <span className="optional">required to publish</span>
              <textarea value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} minLength={20} maxLength={800} rows={4} placeholder="Write a factual, anonymized pattern summary. Do not name or accuse a person, repeat private evidence, or include identifiers." required />
            </label>
            <label>Internal moderation note <span className="optional">optional</span>
              <textarea value={moderationNote} onChange={(event) => setModerationNote(event.target.value)} maxLength={1_000} rows={3} placeholder="Internal decision rationale only; never shown publicly." />
            </label>
            <div className="inline-actions">
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? 'Saving decision…' : 'Publish moderated summary'} <Icon name="send" size={16} />
              </button>
              <button className="button button-secondary" type="button" onClick={() => void decide('rejected')} disabled={saving}>
                Reject report
              </button>
            </div>
          </form>
        )}
      </section>
    )}

    {activeTab === 'overview' && overviewStats && (
      <div>
        <div className="admin-overview-grid">
          <div className="admin-stat-card">
            <span>Pending Reports</span>
            <strong>{overviewStats.moderation.pendingReports}</strong>
            <p>Awaiting moderator review</p>
          </div>
          <div className="admin-stat-card">
            <span>Open Abuse Reports</span>
            <strong>{overviewStats.moderation.openAbuseReports}</strong>
            <p>Flagged by community</p>
          </div>
          <div className="admin-stat-card">
            <span>Active Patterns</span>
            <strong>{overviewStats.system.activePatterns}</strong>
            <p>Detection taxonomy rules</p>
          </div>
          <div className="admin-stat-card">
            <span>Verified Entities</span>
            <strong>{overviewStats.system.verifiedEntities}</strong>
            <p>Trusted domain directory</p>
          </div>
        </div>
        <section className="card">
          <div className="card-heading">
            <div><p className="eyebrow">Aggregate analysis volume</p><h2>Analyses by detected risk level</h2></div>
          </div>
          <div className="admin-risk-grid">
            {overviewStats.system.analysesByRisk.map((item) => (
              <div key={item.level} className="admin-risk-stat-item">
                <span className={`mini-pill ${item.level}`}>{item.level}</span>
                <strong className="admin-risk-stat-count">{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    )}

    {activeTab === 'abuse' && (
      <section className="card">
        <div className="card-heading">
          <div><p className="eyebrow">Community flags</p><h2>Reported community items</h2></div>
          <span className="counter">{abuseReports.length}</span>
        </div>
        {loading ? <LoadingBlock label="Loading abuse reports…" /> : abuseReports.length === 0 ? (
          <div className="moderation-empty"><Icon name="check" size={22} /><strong>No open abuse reports</strong><span>All community reports are clear of pending flags.</span></div>
        ) : (
          <div className="history-list history-list-spaced">
            {abuseReports.map((item) => (
              <div key={item.id} className="history-card">
                <span className="badge-status badge-pending">{item.status}</span>
                <div className="history-copy">
                  <h2>Reason: {item.reason.replace(/_/g, ' ')}</h2>
                  <p>Flagged {formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )}

    {activeTab === 'patterns' && (
      <div>
        <form className="admin-form-card" onSubmit={handleCreatePattern}>
          <div className="card-heading">
            <div><p className="eyebrow">Pattern definition</p><h2>Add or update scam pattern</h2></div>
          </div>
          <div className="structured-grid form-grid-spaced">
            <label><span>Identifier</span><input value={patternForm.id} onChange={(e) => setPatternForm({ ...patternForm, id: e.target.value })} placeholder="e.g. advance_fee_loan" required /></label>
            <label><span>Name</span><input value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })} placeholder="e.g. Advance Fee Loan Scam" required /></label>
            <label><span>Category</span>
              <select value={patternForm.category} onChange={(e) => setPatternForm({ ...patternForm, category: e.target.value })}>
                {reportCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label><span>Severity</span>
              <select value={patternForm.severity} onChange={(e) => setPatternForm({ ...patternForm, severity: e.target.value as any })}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label><span>Applicable Channels</span><input value={patternForm.applicableChannels} onChange={(e) => setPatternForm({ ...patternForm, applicableChannels: e.target.value })} placeholder="sms, email, chat, call" required /></label>
            <label><span>Aliases</span><input value={patternForm.aliases} onChange={(e) => setPatternForm({ ...patternForm, aliases: e.target.value })} placeholder="loan approval, instant cash" /></label>
          </div>
          <label className="form-field-spaced"><span>Description</span>
            <textarea value={patternForm.description} onChange={(e) => setPatternForm({ ...patternForm, description: e.target.value })} rows={3} placeholder="Detailed explanation of tactics, signals, and patterns." required />
          </label>
          <div className="form-actions-spaced">
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Pattern'}
            </button>
          </div>
        </form>
        <div className="pattern-grid">
          {adminPatterns.map((pat) => (
            <article key={pat.id} className="pattern-card">
              <div><span className={`mini-pill ${pat.severity}`}>{severityLabel(pat.severity)}</span><span className="pattern-category">{pat.category.replace(/_/g, ' ')}</span></div>
              <h2>{pat.name}</h2>
              <p>{pat.description}</p>
              <div className="alias-row">{pat.aliases.map((a) => <span key={a}>{a}</span>)}</div>
              <small>ID: {pat.id} · Channels: {pat.applicableChannels.join(', ')}</small>
            </article>
          ))}
        </div>
      </div>
    )}

    {activeTab === 'entities' && (
      <div>
        <form className="admin-form-card" onSubmit={handleCreateEntity}>
          <div className="card-heading">
            <div><p className="eyebrow">Directory entry</p><h2>Add verified organization</h2></div>
          </div>
          <div className="structured-grid form-grid-spaced">
            <label><span>Organization Name</span><input value={entityForm.name} onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })} placeholder="e.g. National Bank" required /></label>
            <label><span>Category</span>
              <select value={entityForm.category} onChange={(e) => setEntityForm({ ...entityForm, category: e.target.value })}>
                <option value="financial_services">Financial Services</option>
                <option value="delivery_logistics">Delivery & Logistics</option>
                <option value="technology_service">Technology Service</option>
                <option value="government_postal">Government / Postal</option>
                <option value="retail_marketplace">Retail / Marketplace</option>
              </select>
            </label>
            <label><span>Official Domains (comma separated)</span><input value={entityForm.officialDomains} onChange={(e) => setEntityForm({ ...entityForm, officialDomains: e.target.value })} placeholder="nationalbank.com, support.nationalbank.com" required /></label>
            <label><span>Aliases</span><input value={entityForm.aliases} onChange={(e) => setEntityForm({ ...entityForm, aliases: e.target.value })} placeholder="NatBank, NBank" /></label>
            <label><span>Official Support URL</span><input value={entityForm.supportChannel} onChange={(e) => setEntityForm({ ...entityForm, supportChannel: e.target.value })} placeholder="https://nationalbank.com/security" /></label>
          </div>
          <div className="form-actions-spaced">
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add Verified Entity'}
            </button>
          </div>
        </form>
        <div className="entity-directory-grid">
          {adminEntities.map((ent) => (
            <article key={ent.id} className="entity-directory-card">
              <span className="pattern-category">{ent.category.replace(/_/g, ' ')}</span>
              <h3>{ent.name}</h3>
              <div className="entity-directory-domains">
                {ent.officialDomains.map((d) => <span key={d} className="entity-directory-domain">{d}</span>)}
              </div>
              <small className="entity-id-tag">ID: {ent.id}</small>
            </article>
          ))}
        </div>
      </div>
    )}

    {activeTab === 'audit' && (
      <section className="card">
        <div className="card-heading">
          <div><p className="eyebrow">System accountability</p><h2>Security & operational audit logs</h2></div>
          <span className="counter">{auditLogs.length}</span>
        </div>
        <p className="section-description">
          All administrative actions, verification checks, and moderation decisions are logged with anonymized identifiers. Raw evidence is never stored in audit logs.
        </p>
        {loading ? <LoadingBlock label="Loading audit trail…" /> : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Outcome</th>
                  <th>Request ID</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td><strong>{log.action}</strong></td>
                    <td>{log.resourceType}{log.resourceId ? ` (#${log.resourceId})` : ''}</td>
                    <td><span className={`mini-pill ${log.outcome === 'success' ? 'low' : 'critical'}`}>{log.outcome}</span></td>
                    <td className="mono-cell">{log.requestId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )}
  </div>;
}


function NotFound() { return <div className="page"><PageHeader eyebrow="Not found" title="This page is not available" /><Link className="button button-primary" to="/analyze">Open analysis workspace</Link></div>; }

function ProtectedRoute({ children }: { children: React.ReactNode }) { return <Workspace>{children}</Workspace>; }

export default function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/analyze" element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>} />
    <Route path="/analyses/:analysisId" element={<ProtectedRoute><AnalysisResultPage /></ProtectedRoute>} />
    <Route path="/incident" element={<ProtectedRoute><IncidentPage /></ProtectedRoute>} />
    <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
    <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
    <Route path="/patterns" element={<ProtectedRoute><PatternsPage /></ProtectedRoute>} />
    <Route path="/verify" element={<ProtectedRoute><VerifyPage /></ProtectedRoute>} />
    <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes></BrowserRouter>;
}
