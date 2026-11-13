import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Editorial image frame. When an article has no image we render a restrained
 * typographic plate instead of a stock illustration — never a fake photograph.
 */
export function ArticleImage({
  src,
  alt,
  caption,
  credit,
  priority,
  className,
  label,
  ratio = "16/9",
  sizes = "(max-width: 768px) 100vw, 60vw",
}: {
  src?: string | null;
  alt: string;
  caption?: string;
  credit?: string;
  priority?: boolean;
  className?: string;
  label?: string;
  ratio?: "16/9" | "4/3" | "3/2" | "1/1";
  sizes?: string;
}) {
  const ratioClass =
    ratio === "4/3" ? "aspect-[4/3]" : ratio === "3/2" ? "aspect-[3/2]" : ratio === "1/1" ? "aspect-square" : "aspect-[16/9]";

  return (
    <figure className={cn("group", className)}>
      <div className={cn("relative overflow-hidden bg-paper-deep", ratioClass)}>
        {src ? (
          src.startsWith("http") ? (
            /* Publisher-hosted wire thumbnail: hotlinked from its own CDN, never
               re-hosted, credited in the caption. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.015]"
            />
          ) : src.endsWith(".svg") ? (
            /* Self-contained SVG artwork (sample edition) — served as-is. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.015]"
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              sizes={sizes}
              className="object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.015]"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-rule bg-[linear-gradient(135deg,#F4F1EA_0%,#FAF9F6_55%,#ECE7DC_100%)]">
            <div className="px-6 text-center">
              <span className="block h-px w-10 bg-gold mx-auto" aria-hidden="true" />
              <span className="mt-3 block font-serif text-[0.95rem] italic text-ink-muted">
                {label ?? "Jan Drishti"}
              </span>
            </div>
          </div>
        )}
      </div>
      {(caption || credit) && (
        <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-3 border-l border-gold/60 pl-2.5 font-sans text-[0.7rem] leading-snug text-ink-muted">
          {caption && <span>{caption}</span>}
          {credit && <span className="text-ink-muted/70">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
