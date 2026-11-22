import { CommentBody } from '@ticketing/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { parseTicketId } from '../tickets/service.js';
import * as comments from './service.js';

const IdParams = z.object({ id: z.string() });

export function commentRoutes(db: Db) {
  return async function (app: FastifyInstance) {
    const r = app.withTypeProvider<ZodTypeProvider>();
    const tags = ['comments'];

    r.get('/tickets/:id/comments', { schema: { tags, summary: "A ticket's comments, oldest first", params: IdParams } }, async (req) =>
      comments.listComments(db, parseTicketId(req.params.id)),
    );

    r.post('/tickets/:id/comments', { schema: { tags, summary: 'Add a comment (does not change the ticket)', params: IdParams, body: CommentBody } }, async (req, reply) =>
      reply.status(201).send(await comments.addComment(db, parseTicketId(req.params.id), req.body.body, req.user.id)),
    );

    r.patch('/comments/:id', { schema: { tags, summary: 'Edit your own comment', params: IdParams, body: CommentBody } }, async (req) =>
      comments.editComment(db, req.params.id, req.body.body, req.user.id),
    );

    r.delete('/comments/:id', { schema: { tags, summary: 'Delete your own comment', params: IdParams } }, async (req, reply) => {
      await comments.deleteComment(db, req.params.id, req.user.id);
      return reply.status(204).send();
    });
  };
}
