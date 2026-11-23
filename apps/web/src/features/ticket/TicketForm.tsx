import { STATE_LABELS, TICKET_STATES, TICKET_TYPES, TYPE_LABELS, TicketCreateBody, toggleChecklistItem } from '@ticketing/shared';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { useEpics, useTeams, type TicketInput } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { modKey, Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/misc';
import { MarkdownBody } from './MarkdownBody';
import { SimilarTickets } from './SimilarTickets';

type Errors = Partial<Record<keyof TicketInput | 'form', string>>;

export interface TicketFormProps {
  mode: 'create' | 'edit';
  initial: TicketInput;
  ticketId?: number;
  onSubmit: (values: TicketInput) => Promise<void>;
  onCancel?: () => void;
  /** Saves a checklist toggle straight away when nothing else is being edited (edit mode). */
  onQuickSaveBody?: (body: string) => Promise<void>;
  autoFocus?: 'title' | 'body';
  /** Extra details shown under the side fields, e.g. created by / modified. */
  meta?: ReactNode;
  /** Rendered between the body and the save bar, e.g. comments. */
  children?: ReactNode;
}

const SERVER_FIELD: Record<string, keyof TicketInput> = {
  TEAM_NOT_FOUND: 'teamId',
  EPIC_NOT_FOUND: 'epicId',
  EPIC_TEAM_MISMATCH: 'epicId',
};

function same(a: TicketInput, b: TicketInput): boolean {
  return a.teamId === b.teamId && a.type === b.type && a.state === b.state && a.epicId === b.epicId && a.title === b.title && a.body === b.body;
}

export function TicketForm({ mode, initial, ticketId, onSubmit, onCancel, onQuickSaveBody, autoFocus = 'title', meta, children }: TicketFormProps) {
  const teams = useTeams();
  const epics = useEpics();
  const [base, setBase] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [epicCleared, setEpicCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bodyTab, setBodyTab] = useState(mode === 'edit' && initial.body ? 'preview' : 'write');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // A refreshed ticket (after a save elsewhere) becomes the new baseline when nothing is being edited.
  const initialKey = JSON.stringify(initial);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    const prevBase = baseRef.current;
    setBase(initial);
    setValues((v) => (same(v, prevBase) ? initial : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  useEffect(() => {
    if (autoFocus === 'body') bodyRef.current?.focus();
    else titleRef.current?.focus();
  }, [autoFocus]);

  const teamEpics = useMemo(() => (epics.data ?? []).filter((e) => e.teamId === values.teamId), [epics.data, values.teamId]);
  const dirty = !same(values, base);

  const set = <K extends keyof TicketInput>(key: K, value: TicketInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const changeTeam = (teamId: string) => {
    setValues((v) => {
      if (v.epicId) setEpicCleared(true);
      return { ...v, teamId, epicId: null };
    });
    setErrors((e) => ({ ...e, teamId: undefined, epicId: undefined }));
  };

  const formId = useId();
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = TicketCreateBody.safeParse(values);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path[0] as keyof TicketInput] ??= i.message;
      setErrors(errs);
      if (errs.body) setBodyTab('write');
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await onSubmit(parsed.data);
      setBase(parsed.data);
      setValues(parsed.data);
      setEpicCleared(false);
    } catch (err) {
      if (err instanceof ApiError && SERVER_FIELD[err.code]) setErrors({ [SERVER_FIELD[err.code]!]: err.message });
      else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.fieldErrors() as Errors);
      else setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (index: number) => {
    const body = toggleChecklistItem(values.body, index);
    if (mode === 'edit' && !dirty && onQuickSaveBody) {
      setValues((v) => ({ ...v, body }));
      setBase((b) => ({ ...b, body }));
      try {
        await onQuickSaveBody(body);
      } catch (err) {
        setValues((v) => ({ ...v, body: values.body }));
        setBase((b) => ({ ...b, body: values.body }));
        setErrors({ form: errorMessage(err) });
      }
    } else {
      set('body', body);
    }
  };

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          void submit();
        }
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-4">
          <Field label="Title" error={errors.title}>
            <Input
              ref={titleRef}
              form={formId}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Short summary of the work"
              className="h-10 text-base font-medium"
              maxLength={200}
            />
          </Field>
          {mode === 'create' && <SimilarTickets teamId={values.teamId} title={values.title} excludeId={ticketId} />}

          <Tabs value={bodyTab} onValueChange={setBodyTab}>
            <div className="flex items-end justify-between">
              <label htmlFor="ticket-body" className="pb-2 text-xs font-medium text-ink-2">
                Body
              </label>
              <TabsList label="Body editor" className="border-b-0">
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="write" forceMount hidden={bodyTab !== 'write'}>
              <Textarea
                id="ticket-body"
                ref={bodyRef}
                value={values.body}
                onChange={(e) => set('body', e.target.value)}
                aria-invalid={errors.body ? true : undefined}
                aria-describedby={errors.body ? 'ticket-body-error' : 'ticket-body-hint'}
                placeholder={'Describe the problem or the change.\n\n- [ ] Use checklists for steps'}
                className="min-h-[12rem] font-[inherit]"
              />
              {errors.body ? (
                <p id="ticket-body-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.body}
                </p>
              ) : (
                <p id="ticket-body-hint" className="mt-1.5 text-xs text-muted">
                  Markdown supported. {modKey}+Enter saves.
                </p>
              )}
            </TabsContent>
            <TabsContent value="preview" className="min-h-[12rem] rounded-md border border-line bg-surface px-3 py-2">
              {values.body.trim() ? <MarkdownBody source={values.body} onToggle={(i) => void toggleItem(i)} disabled={busy} /> : <p className="text-sm text-muted">Nothing to preview.</p>}
            </TabsContent>
          </Tabs>
          {children}
        </div>

        <aside className="space-y-4">
          <Field label="Team" error={errors.teamId}>
            <Select value={values.teamId} onChange={(e) => changeTeam(e.target.value)}>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" error={errors.type}>
            <Select value={values.type} onChange={(e) => set('type', e.target.value as TicketInput['type'])}>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="State" error={errors.state}>
            <Select value={values.state} onChange={(e) => set('state', e.target.value as TicketInput['state'])}>
              {TICKET_STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Epic" error={errors.epicId} hint={epicCleared && !values.epicId ? 'Epic cleared: epics belong to a team' : undefined}>
            <Select
              value={values.epicId ?? ''}
              onChange={(e) => {
                setEpicCleared(false);
                set('epicId', e.target.value || null);
              }}
            >
              <option value="">No epic</option>
              {teamEpics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </Field>
          {meta}
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-6 flex items-center gap-3 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        {errors.form && (
          <p role="alert" className="min-w-0 truncate text-sm font-medium text-danger">
            {errors.form}
          </p>
        )}
        {mode === 'edit' && dirty && !errors.form && <p className="text-xs text-muted">Unsaved changes</p>}
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button onClick={onCancel} disabled={busy}>
              {mode === 'edit' && dirty ? 'Discard' : 'Cancel'}
            </Button>
          )}
          {mode === 'edit' && dirty && !onCancel && (
            <Button onClick={() => setValues(base)} disabled={busy}>
              Discard
            </Button>
          )}
          <Button type="submit" form={formId} variant="primary" loading={busy} disabled={mode === 'edit' && !dirty}>
            {mode === 'create' ? 'Create ticket' : 'Save changes'}
          </Button>
        </div>
      </div>
      {/* The ticket form is empty and linked by id: the comment composer renders inside this layout and must not be a nested form. */}
      <form id={formId} onSubmit={submit} noValidate hidden />
    </div>
  );
}
