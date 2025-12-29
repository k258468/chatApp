export type Role = "teacher" | "student" | "ta";

export type QuestionStatus = "open" | "resolved";

export interface Room {
  id: string;
  code: string;
  name: string;
  channel?: string;
  taKey?: string;
  createdAt: string;
}

export interface Reactions {
  like: number;
  thanks: number;
}

export interface Question {
  id: string;
  roomId: string;
  text: string;
  status: QuestionStatus;
  createdAt: string;
  author?: string;
  anonymous?: boolean;
  reactions: Reactions;
}

export interface Profile {
  xp: number;
  level: number;
  avatarStage: number;
}

export interface UserAccount {
  id: string;
  name: string;
  role: Role;
  email: string;
}
