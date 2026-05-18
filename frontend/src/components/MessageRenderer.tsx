import type { ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';

type MessageRendererProps = {
  content: string;
};

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string; display: boolean; raw: string };

const mathPattern = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\$[^$\n]+?\$)/g;

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(mathPattern)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, index) });
    }

    const display = raw.startsWith('\\[') || raw.startsWith('$$');
    const value = raw.startsWith('\\[')
      ? raw.slice(2, -2)
      : raw.startsWith('\\(')
        ? raw.slice(2, -2)
        : raw.startsWith('$$')
          ? raw.slice(2, -2)
          : raw.slice(1, -1);

    segments.push({ type: 'math', value: value.trim(), display, raw });
    lastIndex = index + raw.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: 'text', value: content }];
}

function parseInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

function renderTextSegment(text: string, keyPrefix: string) {
  const normalized = text.replace(/\r\n/g, '\n');

  return normalized.split(/\n{2,}/).map((block, blockIndex) => {
    const lines = block.split('\n');

    if (!lines.some((line) => line.trim())) {
      return null;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
      return (
        <ul key={`${keyPrefix}-ul-${blockIndex}`}>
          {lines.filter(Boolean).map((line, lineIndex) => (
            <li key={`${keyPrefix}-li-${blockIndex}-${lineIndex}`}>
              {parseInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''), `${keyPrefix}-li-${blockIndex}-${lineIndex}`)}
            </li>
          ))}
        </ul>
      );
    }

    const headingMatch = block.trim().match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      return <h3 key={`${keyPrefix}-h3-${blockIndex}`}>{parseInlineMarkdown(headingMatch[2], `${keyPrefix}-h3-${blockIndex}`)}</h3>;
    }

    return (
      <p key={`${keyPrefix}-p-${blockIndex}`}>
        {lines.map((line, lineIndex) => (
          <span key={`${keyPrefix}-line-${blockIndex}-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {parseInlineMarkdown(line, `${keyPrefix}-line-${blockIndex}-${lineIndex}`)}
          </span>
        ))}
      </p>
    );
  });
}

function MathSegment({ segment }: { segment: Extract<Segment, { type: 'math' }> }) {
  const renderError = () => <span>{segment.raw}</span>;

  return segment.display ? (
    <div className="math-block">
      <BlockMath math={segment.value} renderError={renderError} />
    </div>
  ) : (
    <span className="math-inline">
      <InlineMath math={segment.value} renderError={renderError} />
    </span>
  );
}

function MessageRenderer({ content }: MessageRendererProps) {
  return (
    <>
      {parseSegments(content).map((segment, index) =>
        segment.type === 'math' ? (
          <MathSegment key={`math-${index}`} segment={segment} />
        ) : (
          renderTextSegment(segment.value, `text-${index}`)
        ),
      )}
    </>
  );
}

export default MessageRenderer;
