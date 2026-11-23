import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardedButton } from './GuardedButton';
import { TooltipProvider } from './ui/Tooltip';

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

beforeEach(() => toastMock.error.mockClear());

describe('GuardedButton', () => {
  it('shows the reason as a visible message when a blocked button is clicked, and does not act', async () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <GuardedButton label="Delete team Core" blockedReason="Team has 2 tickets. Move or delete them first." onClick={onClick}>
          x
        </GuardedButton>
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete team Core' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('Team has 2 tickets. Move or delete them first.');
  });

  it('acts normally when nothing blocks it', async () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <GuardedButton label="Delete team Core" onClick={onClick}>
          x
        </GuardedButton>
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete team Core' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
