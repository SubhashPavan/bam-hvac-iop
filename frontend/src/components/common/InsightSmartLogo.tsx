interface InsightSmartLogoProps {
  height?: number;
  className?: string;
  /** "dark" = for light backgrounds (navy mark + navy text),
      "light" = for dark backgrounds (sky-accent mark + white text) */
  variant?: 'dark' | 'light';
}

/**
 * DataLens brand lockup. A small lens / aperture mark in the brand
 * accent colour, sitting next to the wordmark. Kept as the same export
 * (`InsightSmartLogo`) so existing imports don't break — only the
 * rendered output reflects the rebrand.
 */
export default function InsightSmartLogo({
  height = 20,
  className,
  variant = 'dark',
}: InsightSmartLogoProps) {
  const isLight = variant === 'light';
  const markColor = isLight ? '#38BDF8' /* accent-400 */ : '#0EA5E9' /* accent-500 */;
  const textColor = isLight ? 'text-white' : 'text-navy-900';
  const markSize = Math.round(height * 1.1);

  return (
    <div
      className={`flex items-center gap-2 overflow-hidden ${className ?? ''}`}
      aria-label="DataLens"
    >
      {/* Lens mark — concentric circles + accent dot, scales with height */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="13" stroke={markColor} strokeWidth="2" />
        <circle cx="16" cy="16" r="7" stroke={markColor} strokeWidth="2" opacity="0.6" />
        <circle cx="16" cy="16" r="2.5" fill={markColor} />
      </svg>
      <span
        className={`shrink-0 truncate font-semibold tracking-tight ${textColor}`}
        style={{ fontSize: `${Math.round(height * 0.85)}px`, lineHeight: 1 }}
      >
        DataLens
      </span>
    </div>
  );
}
