import type { FindingSeverity, RiskLevel } from '../types/analysis';

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function riskLabel(level: RiskLevel): string {
  return level === 'unclear' ? 'Unclear' : level[0].toUpperCase() + level.slice(1);
}

export function severityLabel(severity: FindingSeverity): string {
  return severity === 'info' ? 'Information' : severity[0].toUpperCase() + severity.slice(1);
}

export function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
