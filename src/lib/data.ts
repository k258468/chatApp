import type {
  Profile,
  Question,
  QuestionStatus,
  Reactions,
  Role,
  Room,
  UserAccount,
} from "../types";
import { getSupabase } from "./supabase";
import { localApi } from "./localStore";

const useLocal = import.meta.env.VITE_USE_LOCAL === "true";

const mapRoom = (row: any): Room => ({
  id: row.id,
  code: row.code,
  name: row.name,
  channel: row.channel,
  taKey: row.ta_key ?? row.taKey ?? undefined,
  createdAt: row.created_at,
});

const mapQuestion = (row: any): Question => ({
  id: row.id,
  roomId: row.room_id,
  text: row.text,
  status: row.status,
  createdAt: row.created_at,
  author: row.author,
  anonymous: row.anonymous ?? false,
  reactions: row.reactions ?? { like: 0, thanks: 0 },
});

export const dataApi = {
  async registerUser(name: string, role: Role): Promise<UserAccount> {
    return localApi.registerUser(name, role);
  },
  async loginUser(name: string, role: Role): Promise<UserAccount | null> {
    return localApi.loginUser(name, role);
  },
  async logoutUser(): Promise<void> {
    return localApi.logoutUser();
  },
  async getCurrentUser(): Promise<UserAccount | null> {
    return localApi.getCurrentUser();
  },
  async createRoom(name: string, channel: string, taKey?: string): Promise<Room> {
    if (useLocal) {
      return localApi.createRoom(name, channel, taKey);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.createRoom(name, channel, taKey);
    }
    const payload: Record<string, unknown> = { name, channel };
    if (taKey) {
      payload.ta_key = taKey;
    }
    const { data, error } = await supabase
      .from("rooms")
      .insert([payload])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create room");
    }
    return mapRoom(data);
  },
  async joinRoom(code: string): Promise<Room | null> {
    if (useLocal) {
      return localApi.joinRoom(code);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.joinRoom(code);
    }
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapRoom(data) : null;
  },
  async listQuestions(roomId: string): Promise<Question[]> {
    if (useLocal) {
      return localApi.listQuestions(roomId);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.listQuestions(roomId);
    }
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to load questions");
    }
    return data.map(mapQuestion);
  },
  async createQuestion(
    roomId: string,
    text: string,
    author?: string,
    anonymous?: boolean
  ): Promise<Question> {
    if (useLocal) {
      return localApi.createQuestion(roomId, text, author, anonymous);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.createQuestion(roomId, text, author, anonymous);
    }
    const { data, error } = await supabase
      .from("questions")
      .insert([{ room_id: roomId, text, author, anonymous }])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create question");
    }
    return mapQuestion(data);
  },
  async updateQuestionStatus(
    questionId: string,
    status: QuestionStatus
  ): Promise<Question | null> {
    if (useLocal) {
      return localApi.updateQuestionStatus(questionId, status);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.updateQuestionStatus(questionId, status);
    }
    const { data, error } = await supabase
      .from("questions")
      .update({ status })
      .eq("id", questionId)
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapQuestion(data) : null;
  },
  async addReaction(
    questionId: string,
    type: keyof Reactions
  ): Promise<Question | null> {
    if (useLocal) {
      return localApi.addReaction(questionId, type);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.addReaction(questionId, type);
    }
    const { data: current, error: readError } = await supabase
      .from("questions")
      .select("reactions")
      .eq("id", questionId)
      .maybeSingle();
    if (readError) {
      throw new Error(readError.message);
    }
    const base: Reactions = current?.reactions ?? { like: 0, thanks: 0 };
    const next = { ...base, [type]: base[type] + 1 };
    const { data, error } = await supabase
      .from("questions")
      .update({ reactions: next })
      .eq("id", questionId)
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapQuestion(data) : null;
  },
  async getProfile(): Promise<Profile> {
    return localApi.getProfile();
  },
  async addXp(amount: number): Promise<Profile> {
    return localApi.addXp(amount);
  },
};
