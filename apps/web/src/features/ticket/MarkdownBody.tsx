import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/**
 * Renders ticket Markdown safely (rehype-sanitize). When `onToggle` is given, task-list checkboxes are clickable;
 * they are numbered in document order, matching `toggleChecklistItem` in the shared package.
 */
export const MarkdownBody = memo(function MarkdownBody({ source, onToggle, disabled }: { source: string; onToggle?: (index: number) => void; disabled?: boolean }) {
  let index = 0;
  return (
    <div className="prose-ticket">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
          input: ({ node: _n, type, checked }) => {
            if (type !== 'checkbox') return null;
            const i = index++;
            return (
              <input
                type="checkbox"
                checked={!!checked}
                disabled={!onToggle || disabled}
                onChange={() => onToggle?.(i)}
                aria-label={`Checklist item ${i + 1}`}
                className="mr-1.5 h-3.5 w-3.5 translate-y-[2px] cursor-pointer accent-[rgb(var(--accent))] disabled:cursor-default"
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
