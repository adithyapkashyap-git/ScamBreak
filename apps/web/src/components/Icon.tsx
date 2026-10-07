import type { SVGProps } from 'react';

export type IconName =
  | 'arrow-right'
  | 'arrow-up-right'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'close'
  | 'copy'
  | 'document'
  | 'download'
  | 'external'
  | 'eye'
  | 'file'
  | 'flag'
  | 'globe'
  | 'history'
  | 'image'
  | 'info'
  | 'link'
  | 'lock'
  | 'menu'
  | 'moon'
  | 'more'
  | 'phone'
  | 'plus'
  | 'scan'
  | 'search'
  | 'send'
  | 'settings'
  | 'shield'
  | 'sun'
  | 'trash'
  | 'triangle'
  | 'user'
  | 'warning';

const paths: Record<IconName, string | string[]> = {
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-up-right': 'M7 17 17 7M8 7h9v9',
  check: 'm5 12 4 4L19 6',
  'chevron-down': 'm6 9 6 6 6-6',
  clock: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  close: 'M6 6l12 12M18 6 6 18',
  copy: ['M8 8h10v10H8z', 'M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  document: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8M8 17h6'],
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14',
  external: ['M14 3h7v7', 'M10 14 21 3', 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  flag: 'M5 21V4m0 0c5-3 8 3 14 0v10c-6 3-9-3-14 0',
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  image: ['M4 4h16v16H4z', 'm4 15 4-4 3 3 3-4 6 5', 'M15 8h.01'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4M12 8h.01'],
  link: ['M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.14', 'M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.14-1.14'],
  lock: ['M6 10V7a6 6 0 0 1 12 0v3', 'M5 10h14v11H5z', 'M12 14v3'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  phone: ['M22 16.9v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.65 2.63a2 2 0 0 1-.45 2.11L8.04 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.31 1.73.53 2.63.65A2 2 0 0 1 22 16.9Z'],
  plus: 'M12 5v14M5 12h14',
  scan: ['M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2', 'M7 12h10'],
  search: ['m21 21-4.35-4.35', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z'],
  send: 'm22 2-7 20-4-9-9-4Z M22 2 11 13',
  settings: ['M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20.3h-3v-.09A1.7 1.7 0 0 0 10.68 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.55-1.03h-.09v-3h.09A1.7 1.7 0 0 0 7.02 9.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.74 5.88l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55v-.09h3v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.09v3h-.09A1.7 1.7 0 0 0 19.4 15Z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  trash: ['M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7'],
  triangle: 'M10.3 3.7 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.7a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  warning: ['M10.3 3.7 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.7a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01'],
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const definition = paths[name];
  const items = Array.isArray(definition) ? definition : [definition];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {items.map((path, index) => <path d={path} key={`${name}-${index}`} />)}
    </svg>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 3.4 29.5 8v8.1c0 8-4.9 13.6-11.5 16.5C11.4 29.7 6.5 24.1 6.5 16.1V8L18 3.4Z" fill="currentColor" />
      <path d="m12.1 18 3.6 3.7 8.2-8.7" stroke="var(--brand-ink)" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
