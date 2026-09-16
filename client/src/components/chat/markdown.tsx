"use client";

import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { generationIdFromImageUrl } from "@/lib/images";

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").origin;

const PAGE_URL = () => (typeof window === "undefined" ? API_ORIGIN : window.location.href);

function hostOf(href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, PAGE_URL()).host;
  } catch {
    return null;
  }
}

/**
 * Model output can carry text planted in documents (prompt injection). A remote
 * image would load with no click and could leak data in its URL, so only this
 * API's own images render; any other image becomes a plain link. Links open in a
 * new tab without a referrer and name their host, so a disguised link is visible.
 */
function link({ href, children }: { href?: string; children?: ReactNode }) {
  const host = hostOf(href);
  const external = host !== null && host !== window.location.host;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
      {external && <span className="text-dim"> ({host})</span>}
    </a>
  );
}

export function Markdown({ content, onOpenGeneration }: { content: string; onOpenGeneration?: (generationId: string) => void }) {
  const components: Components = {
    img: ({ src, alt }) => {
      const url = typeof src === "string" ? src : undefined;
      const generationId = generationIdFromImageUrl(url);
      if (url && hostOf(url) === new URL(API_ORIGIN).host) {
        const image = <img src={url} alt={alt ?? ""} />;
        if (generationId && onOpenGeneration) {
          return (
            <button type="button" className="cursor-pointer p-0" onClick={() => onOpenGeneration(generationId)}>
              {image}
            </button>
          );
        }
        return image;
      }
      return (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow">
          [image{alt ? `: ${alt}` : ""}{hostOf(url) ? ` (${hostOf(url)})` : ""}]
        </a>
      );
    },
    a: link,
  };
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
    </div>
  );
}
