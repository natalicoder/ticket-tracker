import { SimilarQuery, TicketCreateBody, TicketStateBody, TicketUpdateBody } from '@ticketing/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import { listEvents } from './events.js';
import * as tickets from './service.js';

const IdParams = z.object({ id: z.string() });
const TeamParams = z.object({ teamId: z.string() });

export function ticketRoutes(db: Db) {
  return async function (app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();
    const tags = ['tickets'];

    r.get('/teams/:teamId/tickets', { schema: { tags, summary: "A team's board: lightweight cards, most recently modified first", params: TeamParams } }, async (req) =>
      tickets.listBoard(db, req.params.teamId),
    );

    r.get(
      '/teams/:teamId/tickets/similar',
      { schema: { tags, summary: 'Up to 5 tickets in the team whose titles look similar (pg_trgm)', params: TeamParams, querystring: SimilarQuery } },
      async (req) => tickets.findSimilar(db, req.params.teamId, req.query.q, req.query.excludeId),
    );

    r.get('/tickets/:id', { schema: { tags, summary: 'Ticket details', params: IdParams } }, async (req) =>
      tickets.getTicket(db, tickets.parseTicketId(req.params.id)),
    );

    r.post('/tickets', { schema: { tags, summary: 'Create a ticket', body: TicketCreateBody } }, async (req, reply) =>
      reply.status(201).send(await tickets.createTicket(db, req.body, req.user.id)),
    );

    r.patch('/tickets/:id', { schema: { tags, summary: 'Update any ticket fields; the epic must belong to the resulting team', params: IdParams, body: TicketUpdateBody } }, async (req) =>
      tickets.updateTicket(db, tickets.parseTicketId(req.params.id), req.body, req.user.id),
    );

    r.patch('/tickets/:id/state', { schema: { tags, summary: 'Move a ticket to another state (board drag and drop)', params: IdParams, body: TicketStateBody } }, async (req) =>
      tickets.changeState(db, tickets.parseTicketId(req.params.id), req.body.state, req.user.id),
    );

    r.delete('/tickets/:id', { schema: { tags, summary: 'Delete a ticket with its comments and history', params: IdParams } }, async (req, reply) => {
      await tickets.deleteTicket(db, tickets.parseTicketId(req.params.id));
      return reply.status(204).send();
    });

    r.get('/tickets/:id/events', { schema: { tags, summary: 'Activity history, oldest first', params: IdParams } }, async (req) => {
      const id = tickets.parseTicketId(req.params.id);
      if (!(await tickets.ticketExists(db, id))) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
      return listEvents(db, id);
    });
  };
}
