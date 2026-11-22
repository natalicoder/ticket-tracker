import { EpicCreateBody, EpicUpdateBody } from '@ticketing/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import * as epics from './service.js';

const IdParams = z.object({ id: z.string() });
const ListQuery = z.object({ teamId: z.string().uuid('teamId must be a valid id').optional() });

export function epicRoutes(db: Db) {
  return async function (app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();
    const tags = ['epics'];

    r.get('/epics', { schema: { tags, summary: 'Epics sorted by title, optionally for one team', querystring: ListQuery } }, async (req) =>
      epics.listEpics(db, req.query.teamId),
    );

    r.post('/epics', { schema: { tags, summary: 'Create an epic in a team', body: EpicCreateBody } }, async (req, reply) =>
      reply.status(201).send(await epics.createEpic(db, req.body)),
    );

    r.patch('/epics/:id', { schema: { tags, summary: 'Update title/description (the team cannot change)', params: IdParams, body: EpicUpdateBody } }, async (req) =>
      epics.updateEpic(db, req.params.id, req.body),
    );

    r.delete('/epics/:id', { schema: { tags, summary: 'Delete an epic; 409 while tickets use it', params: IdParams } }, async (req, reply) => {
      await epics.deleteEpic(db, req.params.id);
      return reply.status(204).send();
    });
  };
}
