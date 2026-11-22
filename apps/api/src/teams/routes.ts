import { TeamBody } from '@ticketing/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import * as teams from './service.js';

const IdParams = z.object({ id: z.string() });

export function teamRoutes(db: Db) {
  return async function (app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();
    const tags = ['teams'];

    r.get('/teams', { schema: { tags, summary: 'All teams, sorted by name, with ticket and epic counts' } }, async () => teams.listTeams(db));

    r.post('/teams', { schema: { tags, summary: 'Create a team (names are unique, case-insensitive)', body: TeamBody } }, async (req, reply) =>
      reply.status(201).send(await teams.createTeam(db, req.body.name)),
    );

    r.patch('/teams/:id', { schema: { tags, summary: 'Rename a team', params: IdParams, body: TeamBody } }, async (req) =>
      teams.renameTeam(db, req.params.id, req.body.name),
    );

    r.delete('/teams/:id', { schema: { tags, summary: 'Delete a team; 409 while it has tickets or epics', params: IdParams } }, async (req, reply) => {
      await teams.deleteTeam(db, req.params.id);
      return reply.status(204).send();
    });
  };
}
