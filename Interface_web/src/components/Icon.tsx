import type { SVGProps } from 'react';

export type IconName =
  | 'apps'
  | 'ledger'
  | 'invoice'
  | 'receivable'
  | 'payable'
  | 'bank'
  | 'budget'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'menu'
  | 'plus'
  | 'download'
  | 'filter'
  | 'arrow'
  | 'check'
  | 'alert'
  | 'clock'
  | 'building'
  | 'calendar'
  | 'document'
  | 'close';

const paths: Record<IconName, React.ReactNode> = {
  apps: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  ledger: <><path d="M4 4h16v16H4z" /><path d="M8 4v16M12 8h5M12 12h5M12 16h3" /></>,
  invoice: <><path d="M6 3h9l3 3v15l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  receivable: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M13 8l4 4-4 4" /></>,
  payable: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  bank: <><path d="M3 9l9-5 9 5M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16" /></>,
  budget: <><path d="M4 19V9M10 19V4M16 19v-7M22 19H2" /><path d="M3 6l6-3 6 5 6-4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
  arrow: <><path d="M5 12h14" /><path d="M14 7l5 5-5 5" /></>,
  check: <path d="M5 12l4 4L19 6" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 9v5M12 18h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  building: <><path d="M4 21V5h11v16M15 10h5v11M8 9h3M8 13h3M8 17h3M18 14h.01M18 18h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  document: <><path d="M6 3h9l3 3v15H6zM14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export default function Icon({ name, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
