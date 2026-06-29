import type { SVGProps } from "react";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "xmlns"> & {
  size?: number;
  variant?: "color" | "mono";
};

/**
 * Cork app mark — open "C" arc with stopper dot.
 * Derived from mark-black.svg / mark-white.svg in brand/.
 */
export function CorkLogo({ size = 20, variant = "color", ...rest }: LogoProps) {
  const stroke = variant === "color" ? "#1d1b19" : "currentColor";
  const fill = variant === "color" ? "#1d1b19" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Cork"
      {...rest}
    >
      <path d="M72 33 A28 28 0 1 0 72 67" stroke={stroke} strokeWidth={7} strokeLinecap="round" />
      <circle cx="74" cy="50" r="8.5" fill={fill} stroke="none" />
    </svg>
  );
}

export function CorkWordmark({ height = 20, className }: { height?: number; className?: string }) {
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
      <CorkLogo size={height} />
      <span
        style={{
          fontWeight: 700,
          fontSize: Math.round(height * 0.85),
          letterSpacing: "-0.02em",
          color: "var(--color-cork-ink, #0F172A)",
        }}
      >
        Cork
      </span>
    </span>
  );
}

/** @deprecated Use CorkLogo instead */
export const NoxeLogo = CorkLogo;
/** @deprecated Use CorkWordmark instead */
export const NoxeWordmark = CorkWordmark;
