import { CommentBody, type CommentDto } from '@ticketing/shared';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import { useAddComment, useComments, useDeleteComment, useEditComment, useMe } from '../../api/queries';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorCard } from '../../components/EmptyState';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { modKey, Skeleton } from '../../components/ui/misc';
import { Tooltip } from '../../components/ui/Tooltip';
import { absoluteTime, relativeTime } from '../../lib/time';
import { MarkdownBody } from './MarkdownBody';

export function Avatar({ email }: { email: string }) {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold uppercase text-accent">
      {email.slice(0, 2)}
    </span>
  );
}

function Composer({ initial = '', submitLabel, onSubmit, onCancel, autoFocus }: { initial?: string; submitLabel: string; onSubmit: (body: string) => Promise<unknown>; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = CommentBody.safeParse({ body });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(parsed.data.body);
      setBody('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`composer-${submitLabel}`} className="sr-only">
        {submitLabel === 'Comment' ? 'Add a comment' : 'Edit comment'}
      </label>
      <Textarea
        id={`composer-${submitLabel}`}
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setError(undefined);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            void submit();
          } else if (e.key === 'Escape' && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
        aria-invalid={error ? true : undefined}
        placeholder="Leave a comment…"
        className="min-h-[4.5rem]"
      />
      <div className="flex items-center gap-2">
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <span className="ml-auto text-2xs text-muted">{modKey}+Enter to send</span>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button size="sm" variant="primary" type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({ c, mine, ticketId }: { c: CommentDto; mine: boolean; ticketId: number }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const edit = useEditComment(ticketId);
  const del = useDeleteComment(ticketId);
  return (
    <li className="group flex gap-3">
      <Avatar email={c.author.email} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-ink">{c.author.email}</span>
          <Tooltip content={absoluteTime(c.createdAt)}>
            <time dateTime={c.createdAt} className="text-xs text-muted">
              {relativeTime(c.createdAt)}
            </time>
          </Tooltip>
          {c.editedAt && (
            <span className="text-xs text-muted" title={`Edited ${absoluteTime(c.editedAt)}`}>
              (edited)
            </span>
          )}
          {mine && !editing && (
            <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button type="button" aria-label="Edit comment" onClick={() => setEditing(true)} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Delete comment" onClick={() => setConfirm(true)} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        <div className="mt-1">
          {editing ? (
            <Composer
              autoFocus
              initial={c.body}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await edit.mutateAsync({ id: c.id, body });
                setEditing(false);
              }}
            />
          ) : (
            <MarkdownBody source={c.body} />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this comment?"
        description="This cannot be undone."
        confirmLabel="Delete comment"
        destructive
        onConfirm={async () => {
          try {
            await del.mutateAsync(c.id);
            toast.success('Comment deleted');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </li>
  );
}

export function Comments({ ticketId }: { ticketId: number }) {
  const comments = useComments(ticketId);
  const me = useMe();
  const add = useAddComment(ticketId);
  const list = comments.data ?? [];
  return (
    <div className="space-y-5">
      {comments.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : comments.isError ? (
        <ErrorCard message={errorMessage(comments.error)} onRetry={() => void comments.refetch()} />
      ) : list.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MessageSquare className="h-4 w-4" aria-hidden /> No comments yet. Start the conversation below.
        </p>
      ) : (
        <ol className="space-y-4" aria-label="Comments, oldest first">
          {list.map((c) => (
            <CommentItem key={c.id} c={c} mine={c.author.id === me.data?.id} ticketId={ticketId} />
          ))}
        </ol>
      )}
      <Composer submitLabel="Comment" onSubmit={(body) => add.mutateAsync(body)} />
    </div>
  );
}
