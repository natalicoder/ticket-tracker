import * as AD from '@radix-ui/react-alert-dialog';
import { useState, type ReactNode } from 'react';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the error (toast); keep the dialog open so the user can retry or cancel.
    } finally {
      setBusy(false);
    }
  };
  return (
    <AD.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-40 bg-ink/30 animate-fade-in dark:bg-black/60" />
        <AD.Content className="fixed left-1/2 top-[18vh] z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-lg bg-surface p-5 shadow-pop animate-pop-in focus:outline-none">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          <AD.Description className="mt-1.5 text-sm text-muted">{description}</AD.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AD.Cancel asChild>
              <Button disabled={busy}>Cancel</Button>
            </AD.Cancel>
            <Button variant={destructive ? 'danger' : 'primary'} loading={busy} onClick={() => void confirm()}>
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
