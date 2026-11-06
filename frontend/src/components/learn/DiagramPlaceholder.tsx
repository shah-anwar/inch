import { cn } from "@/lib/utils";

type DiagramPlaceholderProps = {
  /** Short title shown inside the box (e.g. "Figure: argument graph"). */
  label: string;
  /** What the final screenshot or diagram should depict. */
  caption: string;
  className?: string;
};

/**
 * Marks where a future diagram or screenshot should be inserted in documentation pages.
 */
export function DiagramPlaceholder({ label, caption, className }: DiagramPlaceholderProps) {
  return (
    <figure
      className={cn(
        "my-8 rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted/25 px-6 py-10 text-center",
        className,
      )}
    >
      <figcaption className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </figcaption>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {caption}
      </p>
    </figure>
  );
}
