import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  as?: "span" | "div";
}

const Wordmark = ({ className, as: Tag = "span" }: WordmarkProps) => (
  <Tag className={cn("wordmark", className)}>LUCA RAMSEYER</Tag>
);

export default Wordmark;
