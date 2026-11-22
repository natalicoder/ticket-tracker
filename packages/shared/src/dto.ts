import type { TicketState, TicketType } from './enums.js';

/** All timestamps are ISO-8601 UTC strings. */
export type IsoDate = string;

export interface UserDto {
  id: string;
  email: string;
}

export interface TeamDto {
  id: string;
  name: string;
  createdAt: IsoDate;
  modifiedAt: IsoDate;
  ticketCount: number;
  epicCount: number;
}

export interface EpicDto {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  createdAt: IsoDate;
  modifiedAt: IsoDate;
  ticketCount: number;
}

export interface ChecklistProgress {
  done: number;
  total: number;
}

export interface TicketCardDto {
  id: number;
  teamId: string;
  type: TicketType;
  state: TicketState;
  epicId: string | null;
  title: string;
  modifiedAt: IsoDate;
  stateSince: IsoDate;
  checklist: ChecklistProgress;
}

export interface TicketDto extends TicketCardDto {
  body: string;
  createdAt: IsoDate;
  createdBy: UserDto;
}

export interface CommentDto {
  id: string;
  ticketId: number;
  author: UserDto;
  body: string;
  createdAt: IsoDate;
  editedAt: IsoDate | null;
}

export interface TicketEventDto {
  id: string;
  actor: UserDto;
  kind: 'created' | 'updated';
  field: string | null;
  from: string | null;
  to: string | null;
  at: IsoDate;
}

export interface SimilarTicketDto {
  id: number;
  title: string;
  state: TicketState;
  score: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
