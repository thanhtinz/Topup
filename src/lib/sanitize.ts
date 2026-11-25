import sanitizeHtml from "sanitize-html";

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
      "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a", "img",
      "hr", "code", "pre", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], span: ["style"],
      li: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
  }).trim();
}

export function plainTextToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n");
}

export function isHtmlContent(content: string): boolean {
  return /<(p|h2|h3|ul|ol|blockquote|img|br)[\s>]/.test(content);
}
