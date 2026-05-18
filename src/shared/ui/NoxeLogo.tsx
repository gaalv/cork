import type { SVGProps } from "react";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "xmlns"> & {
  size?: number;
  variant?: "color" | "mono";
};

export function NoxeLogo({ size = 20, variant = "color", ...rest }: LogoProps) {
  const fillBg = variant === "color" ? "url(#noxe-logo-bg)" : "currentColor";
  const strokeColor = variant === "color" ? "#FFFFFF" : "var(--color-noxe-panel)";
  const accent = variant === "color" ? "#FF9A3C" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Noxe"
      {...rest}
    >
      {variant === "color" ? (
        <defs>
          <linearGradient id="noxe-logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3F3DFF" />
            <stop offset="1" stopColor="#1F1D5A" />
          </linearGradient>
        </defs>
      ) : null}
      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={fillBg} />
      <path
        d="M132 372 V140 L380 372 V140"
        fill="none"
        stroke={strokeColor}
        strokeWidth={48}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="380" cy="140" r="22" fill={accent} />
    </svg>
  );
}

export function NoxeWordmark({ height = 20, className }: { height?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        lineHeight: 1,
      }}
    >
      <NoxeLogo size={height} />
      <span
        style={{
          fontWeight: 700,
          fontSize: Math.round(height * 0.85),
          letterSpacing: "-0.02em",
          color: "var(--color-noxe-ink, #0F172A)",
        }}
      >
        Noxe
      </span>
    </span>
  );
}
