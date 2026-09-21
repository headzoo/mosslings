import type { ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type Block =
  | { id: string; type: "heading"; level: HeadingLevel; text: string }
  | { id: string; type: "paragraph"; text: string }
  | {
      id: string;
      type: "list";
      ordered: boolean;
      items: { id: string; text: string }[];
    }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "code"; text: string }
  | { id: string; type: "rule" };

const HEADING = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

export function Markdown({ source }: { source: string }) {
  return (
    <div className="help-markdown">
      {parseMarkdown(source).map((block) => (
        <MarkdownBlock key={block.id} block={block} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const Tag = HEADING[block.level];
      return <Tag>{renderInline(block.text, block.id)}</Tag>;
    }
    case "paragraph":
      return <p>{renderInline(block.text, block.id)}</p>;
    case "quote":
      return <blockquote>{renderInline(block.text, block.id)}</blockquote>;
    case "code":
      return (
        <pre>
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr />;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag>
          {block.items.map((item) => (
            <li key={item.id}>{renderInline(item.text, item.id)}</li>
          ))}
        </Tag>
      );
    }
  }
}

function renderInline(source: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let matchIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(source.slice(last, start));
    const nodeKey = `${key}-${matchIndex}`;
    matchIndex += 1;
    if (match[1] !== undefined) {
      const src = safeUrl(match[2] ?? "");
      nodes.push(
        src ? (
          // Help documents can point at any image path, with no known size.
          // biome-ignore lint/performance/noImgElement: markdown images are not sized ahead of time
          <img key={nodeKey} src={src} alt={match[1]} />
        ) : (
          match[0]
        ),
      );
    } else if (match[3] !== undefined) {
      const href = safeUrl(match[4] ?? "");
      nodes.push(
        href ? (
          <a key={nodeKey} href={href} {...linkProps(href)}>
            {match[3]}
          </a>
        ) : (
          match[0]
        ),
      );
    } else if (match[5] !== undefined) {
      nodes.push(<code key={nodeKey}>{match[5]}</code>);
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={nodeKey}>{match[6]}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<em key={nodeKey}>{match[7]}</em>);
    }
    last = start + match[0].length;
  }
  if (last < source.length) nodes.push(source.slice(last));
  return nodes;
}

function linkProps(href: string) {
  if (/^https?:/i.test(href)) {
    return { target: "_blank", rel: "noreferrer noopener" } as const;
  }
  return {};
}

function safeUrl(url: string) {
  const value = url.trim();
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("./") ||
    value.startsWith("../")
  ) {
    return value;
  }
  return null;
}

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  let nextId = 0;
  const id = () => {
    nextId += 1;
    return `md-${nextId}`;
  };
  const current = () => lines[index] ?? "";

  while (index < lines.length) {
    const line = current();
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !current().startsWith("```")) {
        code.push(current());
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ id: id(), type: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({
        id: id(),
        type: "heading",
        level: headingLevel(heading[1].length),
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }
    if (isRule(line)) {
      blocks.push({ id: id(), type: "rule" });
      index += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && current().startsWith(">")) {
        quote.push(current().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ id: id(), type: "quote", text: quote.join(" ") });
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const marker = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items: { id: string; text: string }[] = [];
      while (index < lines.length && marker.test(current())) {
        const parts = [current().replace(marker, "")];
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(current())) {
          parts.push(current().trim());
          index += 1;
        }
        items.push({ id: id(), text: parts.join(" ") });
      }
      blocks.push({ id: id(), type: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && isParagraphLine(current())) {
      paragraph.push(current().trim());
      index += 1;
    }
    if (paragraph.length === 0) {
      index += 1;
      continue;
    }
    blocks.push({ id: id(), type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function headingLevel(length: number): HeadingLevel {
  if (length <= 1) return 1;
  if (length === 2) return 2;
  if (length === 3) return 3;
  if (length === 4) return 4;
  if (length === 5) return 5;
  return 6;
}

function isRule(line: string) {
  return /^([-*_])\1{2,}$/.test(line.trim());
}

function isParagraphLine(line: string) {
  return (
    line.trim() !== "" &&
    !line.startsWith("```") &&
    !line.startsWith(">") &&
    !/^(#{1,6})\s+/.test(line) &&
    !/^[-*]\s+/.test(line) &&
    !/^\d+\.\s+/.test(line) &&
    !isRule(line)
  );
}
