import { cn } from "@/lib/utils";

interface MarkProps {
  /** Colour showing through the knocked-out cross. Match the surface behind it. */
  knockout?: string;
  size?: number;
  className?: string;
}

/**
 * The Swiss cross mark. Ratios are fixed by the brand guide at any size:
 * arm thickness 21.5%, arm length 62%, corner radius 10%.
 */
const Mark = ({ knockout = "#F4EFE4", size = 28, className }: MarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    role="img"
    aria-label="Luca Ramseyer"
    className={cn("block shrink-0", className)}
  >
    <rect width="100" height="100" rx="10" fill="#C0473A" />
    <rect x="39.25" y="19" width="21.5" height="62" fill={knockout} />
    <rect x="19" y="39.25" width="62" height="21.5" fill={knockout} />
  </svg>
);

export default Mark;
