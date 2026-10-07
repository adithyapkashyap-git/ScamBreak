import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnalysisScanner } from './AnalysisScanner';

describe('AnalysisScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders status role, active telemetry HUD, and evidence count', () => {
    render(
      <AnalysisScanner
        evidenceCount={3}
        caseTitle="Suspicious Delivery Message"
        allowAi={true}
      />,
    );

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Analyzing evidence…')).toBeDefined();
    expect(screen.getByText('Suspicious Delivery Message')).toBeDefined();
    expect(screen.getByText('3 evidence items')).toBeDefined();
    expect(screen.getByText('External AI assisted')).toBeDefined();
    expect(screen.getByText('Decomposing URL & protocol structure')).toBeDefined();
  });

  it('cycles through telemetry inspection phases over time', () => {
    render(
      <AnalysisScanner
        evidenceCount={1}
      />,
    );

    expect(screen.getByText('Decomposing URL & protocol structure')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1900);
    });

    expect(screen.getByText('Scanning urgency & psychological pressure')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1900);
    });

    expect(screen.getByText('Extracting credential & payment requests')).toBeDefined();
  });
});
