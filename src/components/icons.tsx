type P = { className?: string };
const base = { viewBox: "0 0 24 24", "aria-hidden": true } as const;
const line = {
  ...base,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const PlayIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className} fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const InfoIcon = ({ className = "size-5" }: P) => (
  <svg {...line} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const SearchIcon = ({ className = "size-5" }: P) => (
  <svg {...line} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const ChevronLeft = ({ className = "size-5" }: P) => (
  <svg {...line} className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
export const ChevronRight = ({ className = "size-5" }: P) => (
  <svg {...line} className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
export const PhoneIcon = ({ className = "size-5" }: P) => (
  <svg {...line} className={className}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);