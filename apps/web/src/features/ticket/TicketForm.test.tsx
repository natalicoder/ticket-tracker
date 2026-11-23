import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TicketInput } from '../../api/queries';
import { mockFetch, renderWithProviders } from '../../test/utils';
import { TicketForm } from './TicketForm';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const EA = '00000000-0000-4000-8000-0000000000ea';
const EB = '00000000-0000-4000-8000-0000000000eb';
const teams = [
  { id: A, name: 'Alpha', createdAt: '', modifiedAt: '', ticketCount: 0, epicCount: 1 },
  { id: B, name: 'Beta', createdAt: '', modifiedAt: '', ticketCount: 0, epicCount: 1 },
];
const epics = [
  { id: EA, teamId: A, title: 'Auth', description: null, createdAt: '', modifiedAt: '', ticketCount: 0 },
  { id: EB, teamId: B, title: 'Billing', description: null, createdAt: '', modifiedAt: '', ticketCount: 0 },
];

function setup(props: Partial<Parameters<typeof TicketForm>[0]> = {}) {
  const fetchMock = mockFetch({
    'GET /api/teams': { status: 200, body: teams },
    'GET /api/epics': { status: 200, body: epics },
    [`GET /api/teams/${A}/tickets/similar`]: { status: 200, body: [] },
  });
  const onSubmit = vi.fn(async () => {});
  renderWithProviders(
    <TicketForm
      mode="create"
      initial={{ teamId: A, type: 'bug', state: 'new', epicId: EA, title: '', body: '' }}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { fetchMock, onSubmit };
}

describe('TicketForm', () => {
  it('keeps a child form (the comment composer) outside its own form, so submitting it does not submit the ticket', async () => {
    const childSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { onSubmit } = setup({
      children: (
        <form onSubmit={childSubmit}>
          <button type="submit">Comment</button>
        </form>
      ),
    });
    await screen.findByLabelText('Epic');
    expect(document.querySelector('form form')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(childSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('Title must not be empty')).toBeNull();
  });

  it('clears the epic and lists only the new team’s epics when the team changes', async () => {
    setup();
    const epic = await screen.findByLabelText('Epic');
    await waitFor(() => expect(epic).toHaveValue(EA));
    await userEvent.selectOptions(screen.getByLabelText('Team'), B);
    expect(epic).toHaveValue('');
    const options = within(epic).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['No epic', 'Billing']);
    expect(screen.getByText('Epic cleared: epics belong to a team')).toBeInTheDocument();
  });

  it('flags a whitespace-only title without calling the API', async () => {
    const { onSubmit } = setup();
    await screen.findByLabelText('Epic');
    await userEvent.type(screen.getByLabelText('Title'), '   ');
    await userEvent.type(screen.getByLabelText('Body'), 'Something');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText('Title must not be empty')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values', async () => {
    const { onSubmit } = setup();
    await screen.findByLabelText('Epic');
    await userEvent.type(screen.getByLabelText('Title'), '  Login fails ');
    await userEvent.type(screen.getByLabelText('Body'), 'Steps');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ teamId: A, type: 'bug', state: 'new', epicId: EA, title: 'Login fails', body: 'Steps' }, expect.anything()));
  });

  it('keeps Save disabled in edit mode until something changes', async () => {
    setup({ mode: 'edit', ticketId: 7, initial: { teamId: A, type: 'bug', state: 'new', epicId: null, title: 'Old', body: 'B' } });
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Title'), '!');
    expect(save).toBeEnabled();
    await userEvent.type(screen.getByLabelText('Title'), '{Backspace}');
    expect(save).toBeDisabled();
  });

  it('keeps a change someone else saved meanwhile and sends only the fields this user edited', async () => {
    mockFetch({
      'GET /api/teams': { status: 200, body: teams },
      'GET /api/epics': { status: 200, body: epics },
    });
    const onSubmit = vi.fn(async (_values: unknown, _changed: unknown) => {});
    const start: TicketInput = { teamId: A, type: 'bug', state: 'new', epicId: EA, title: 'Old', body: 'B' };
    function Harness() {
      const [initial, setInitial] = useState(start);
      return (
        <>
          <button type="button" onClick={() => setInitial({ ...start, state: 'done' })}>
            Someone moves it
          </button>
          <TicketForm mode="edit" ticketId={7} initial={initial} onSubmit={onSubmit} />
        </>
      );
    }
    renderWithProviders(<Harness />);
    await screen.findByLabelText('Epic');
    await userEvent.type(screen.getByLabelText('Title'), ' title');
    await userEvent.click(screen.getByRole('button', { name: 'Someone moves it' }));
    expect(screen.getByLabelText('State')).toHaveValue('done');
    expect(screen.getByLabelText('Title')).toHaveValue('Old title');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![1]).toEqual({ title: 'Old title' });
  });

  it('maps a server field error to its field', async () => {
    const { ApiError } = await import('../../api/client');
    const onSubmit = vi.fn(async () => {
      throw new ApiError(400, 'EPIC_TEAM_MISMATCH', 'Epic belongs to a different team. Choose an epic from Alpha.');
    });
    setup({ onSubmit });
    await screen.findByLabelText('Epic');
    await userEvent.type(screen.getByLabelText('Title'), 'T');
    await userEvent.type(screen.getByLabelText('Body'), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText('Epic belongs to a different team. Choose an epic from Alpha.')).toBeInTheDocument();
  });
});
