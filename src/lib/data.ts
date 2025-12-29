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
const requireSupabase = () => {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase が設定されていません。ENV を確認してください。");
  }
  return supabase;
};

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
  async registerUser(
    name: string,
    role: Role,
    email: string,
    password: string
  ): Promise<UserAccount> {
    if (useLocal) {
      return localApi.registerUser(name, role, email, password);
    }
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, role } },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Failed to register");
    }
    const profilePayload = { id: data.user.id, display_name: name, role };
    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);
    if (profileError) {
      throw new Error(profileError.message);
    }
    return { id: data.user.id, name, role, email };
  },
  async loginUser(email: string, password: string): Promise<UserAccount | null> {
    if (useLocal) {
      return localApi.loginUser(email, password);
    }
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return null;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error(profileError?.message ?? "プロフィールが見つかりません。");
    }
    return { id: data.user.id, name: profile.display_name, role: profile.role, email };
  },
  async logoutUser(): Promise<void> {
    if (useLocal) {
      return localApi.logoutUser();
    }
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },
  async getCurrentUser(): Promise<UserAccount | null> {
    if (useLocal) {
      return localApi.getCurrentUser();
    }
    const supabase = getSupabase();
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      return null;
    }
    return {
      id: data.user.id,
      name: profile.display_name,
      role: profile.role,
      email: data.user.email ?? "",
    };
  },
  async listJoinedRooms(): Promise<Room[]> {
    if (useLocal) {
      return localApi.listJoinedRooms();
    }
    const supabase = requireSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return [];
    }
    const { data, error } = await supabase
      .from("room_members")
      .select("room:rooms(*)")
      .eq("user_id", authData.user.id)
      .order("joined_at", { ascending: false });
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to load rooms");
    }
    return data
      .map((entry) => entry.room)
      .filter(Boolean)
      .map(mapRoom);
  },
  async createRoom(name: string, channel: string, taKey?: string): Promise<Room> {
    if (useLocal) {
      return localApi.createRoom(name, channel, taKey);
    }
    const supabase = requireSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error("認証が必要です。");
    }
    const payload: Record<string, unknown> = { name, channel };
    if (taKey) {
      payload.ta_key = taKey;
    }
    payload.created_by = authData.user.id;
    const { data, error } = await supabase
      .from("rooms")
      .insert([payload])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create room");
    }
    const { error: memberError } = await supabase.from("room_members").upsert(
      { room_id: data.id, user_id: authData.user.id },
      { onConflict: "room_id,user_id", ignoreDuplicates: true }
    );
    if (memberError) {
      throw new Error(memberError.message);
    }
    return mapRoom(data);
  },
  async joinRoom(code: string): Promise<Room | null> {
    if (useLocal) {
      return localApi.joinRoom(code);
    }
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (data) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { error: memberError } = await supabase.from("room_members").upsert(
          { room_id: data.id, user_id: authData.user.id },
          { onConflict: "room_id,user_id", ignoreDuplicates: true }
        );
        if (memberError) {
          throw new Error(memberError.message);
        }
      }
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
