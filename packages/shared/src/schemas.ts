import { z } from 'zod';
import { TICKET_STATES, TICKET_TYPES } from './enums.js';

export const LIMITS = {
  email: 254,
  password: 256,
  teamName: 100,
  epicTitle: 200,
  epicDescription: 5000,
  ticketTitle: 200,
  ticketBody: 20000,
  comment: 10000,
} as const;

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(LIMITS.email, 'Email is too long')
  .email('Enter a valid email address');

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(LIMITS.password, `Password must be at most ${LIMITS.password} characters`);

/** A trimmed string that must contain at least one non-space character. */
export function nonBlank(field: string, max: number) {
  return z
    .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be text` })
    .trim()
    .min(1, `${field} must not be empty`)
    .max(max, `${field} must be at most ${max} characters`);
}

/** Multi-line text: must not be blank; leading whitespace is kept, trailing whitespace is trimmed. */
export function nonBlankText(field: string, max: number) {
  return z
    .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be text` })
    .refine((s) => s.trim().length > 0, `${field} must not be empty`)
    .transform((s) => s.trimEnd())
    .refine((s) => s.length <= max, `${field} must be at most ${max} characters`);
}

const uuid = (field: string) => z.string({ required_error: `${field} is required` }).uuid(`${field} must be a valid id`);

// ---- Auth ----
export const SignupBody = z.object({ email: emailSchema, password: passwordSchema });
export const LoginBody = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(LIMITS.password),
});
export const TokenBody = z.object({ token: z.string().min(1, 'Token is required').max(200) });
export const EmailBody = z.object({ email: emailSchema });
export const ResetPasswordBody = z.object({ token: z.string().min(1, 'Token is required').max(200), password: passwordSchema });

// ---- Teams & epics ----
export const TeamBody = z.object({ name: nonBlank('Name', LIMITS.teamName) });

const epicDescription = z
  .string()
  .max(LIMITS.epicDescription, `Description must be at most ${LIMITS.epicDescription} characters`)
  .transform((s) => (s.trim() === '' ? null : s.trimEnd()))
  .nullable()
  .optional();

export const EpicCreateBody = z.object({
  teamId: uuid('Team'),
  title: nonBlank('Title', LIMITS.epicTitle),
  description: epicDescription,
});

export const EpicUpdateBody = z
  .object({
    title: nonBlank('Title', LIMITS.epicTitle).optional(),
    description: epicDescription,
  })
  .strict();

// ---- Tickets ----
export const ticketTypeSchema = z.enum(TICKET_TYPES, {
  errorMap: () => ({ message: `Type must be one of: ${TICKET_TYPES.join(', ')}` }),
});
export const ticketStateSchema = z.enum(TICKET_STATES, {
  errorMap: () => ({ message: `State must be one of: ${TICKET_STATES.join(', ')}` }),
});

const ticketFields = {
  teamId: uuid('Team'),
  type: ticketTypeSchema,
  state: ticketStateSchema,
  epicId: uuid('Epic').nullable(),
  title: nonBlank('Title', LIMITS.ticketTitle),
  body: nonBlankText('Body', LIMITS.ticketBody),
};

export const TicketCreateBody = z.object({
  ...ticketFields,
  state: ticketFields.state.default('new'),
  epicId: ticketFields.epicId.default(null),
});

export const TicketUpdateBody = z.object(ticketFields).partial();

export const TicketStateBody = z.object({ state: ticketStateSchema });

export const CommentBody = z.object({ body: nonBlankText('Comment', LIMITS.comment) });

export const BoardQuery = z.object({});

export const SimilarQuery = z.object({
  q: z.string().trim().min(3, 'Query must be at least 3 characters').max(LIMITS.ticketTitle),
  excludeId: z.coerce.number().int().positive().optional(),
});

export type SignupInput = z.infer<typeof SignupBody>;
export type LoginInput = z.infer<typeof LoginBody>;
export type TeamInput = z.infer<typeof TeamBody>;
export type EpicCreateInput = z.infer<typeof EpicCreateBody>;
export type EpicUpdateInput = z.infer<typeof EpicUpdateBody>;
export type TicketCreateInput = z.infer<typeof TicketCreateBody>;
export type TicketUpdateInput = z.infer<typeof TicketUpdateBody>;
export type CommentInput = z.infer<typeof CommentBody>;
