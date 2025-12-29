import type {
  Answer,
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

const mapAnswer = (row: any): Answer => ({
  id: row.id,
  questionId: row.question_id,
  text: row.text,
  author: row.author,
  role: row.role,
  createdAt: row.created_at,
  reactions: row.reactions ?? { like: 0, thanks: 0 },
});

const mapQuestion = (row: any): Question => ({
  id: row.id,
  roomId: row.room_id,
  text: row.text,
  status: row.status,
  createdAt: row.created_at,
  ownerId: row.owner_id ?? undefined,
  author: row.author,
  anonymous: row.anonymous ?? false,
  reactions: row.reactions ?? { like: 0, thanks: 0 },
  answers: (row.answers ?? []).map(mapAnswer).sort((a: Answer, b: Answer) =>
    a.createdAt.localeCompare(b.createdAt)
  ),
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
      .select("*, answers(*)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to load questions");
    }
    const questionIds = data.map((row) => row.id);
    const answerIds = data.flatMap((row) => (row.answers ?? []).map((answer: any) => answer.id));
    const reactionsByQuestion = new Map<string, Reactions>();
    const reactionsByAnswer = new Map<string, Reactions>();
    if (questionIds.length) {
      const { data: reactionRows, error: reactionError } = await supabase
        .from("question_reactions")
        .select("question_id, type")
        .in("question_id", questionIds);
      if (reactionError) {
        throw new Error(reactionError.message);
      }
      for (const row of reactionRows ?? []) {
        const current = reactionsByQuestion.get(row.question_id) ?? { like: 0, thanks: 0 };
        current[row.type as keyof Reactions] += 1;
        reactionsByQuestion.set(row.question_id, current);
      }
    }
    if (answerIds.length) {
      const { data: reactionRows, error: reactionError } = await supabase
        .from("answer_reactions")
        .select("answer_id, type")
        .in("answer_id", answerIds);
      if (reactionError) {
        throw new Error(reactionError.message);
      }
      for (const row of reactionRows ?? []) {
        const current = reactionsByAnswer.get(row.answer_id) ?? { like: 0, thanks: 0 };
        current[row.type as keyof Reactions] += 1;
        reactionsByAnswer.set(row.answer_id, current);
      }
    }
    return data.map((row) => {
      const question = mapQuestion(row);
      question.reactions = reactionsByQuestion.get(question.id) ?? { like: 0, thanks: 0 };
      question.answers = question.answers.map((answer) => ({
        ...answer,
        reactions: reactionsByAnswer.get(answer.id) ?? { like: 0, thanks: 0 },
      }));
      return question;
    });
  },
  async createQuestion(
    roomId: string,
    text: string,
    author?: string,
    anonymous?: boolean,
    ownerId?: string
  ): Promise<Question> {
    if (useLocal) {
      return localApi.createQuestion(roomId, text, author, anonymous, ownerId);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.createQuestion(roomId, text, author, anonymous, ownerId);
    }
    let resolvedOwnerId = ownerId;
    if (!resolvedOwnerId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedOwnerId = authData.user?.id;
    }
    const { data, error } = await supabase
      .from("questions")
      .insert([{ room_id: roomId, text, author, anonymous, owner_id: resolvedOwnerId }])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create question");
    }
    return {
      ...mapQuestion(data),
      answers: [],
    };
  },
  async createAnswer(
    questionId: string,
    text: string,
    author: string,
    role: Role
  ): Promise<Answer> {
    if (useLocal) {
      return localApi.createAnswer(questionId, text, author, role);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.createAnswer(questionId, text, author, role);
    }
    const { data, error } = await supabase
      .from("answers")
      .insert([{ question_id: questionId, text, author, role }])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create answer");
    }
    return {
      ...mapAnswer(data),
      reactions: { like: 0, thanks: 0 },
    };
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
      .select("*, answers(*)")
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapQuestion(data) : null;
  },
  async addQuestionReaction(
    questionId: string,
    type: keyof Reactions,
    userId: string
  ): Promise<Question | null> {
    if (useLocal) {
      return localApi.addQuestionReaction(questionId, type, userId);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.addQuestionReaction(questionId, type, userId);
    }
    const { data: inserted, error: insertError } = await supabase
      .from("question_reactions")
      .insert([{ question_id: questionId, user_id: userId, type }])
      .select("id")
      .maybeSingle();
    if (insertError) {
      if (insertError.code === "23505") {
        return null;
      }
      throw new Error(insertError.message);
    }
    if (!inserted) {
      return null;
    }
    const { data: questionRow, error: questionError } = await supabase
      .from("questions")
      .select("*, answers(*)")
      .eq("id", questionId)
      .maybeSingle();
    if (questionError) {
      throw new Error(questionError.message);
    }
    if (!questionRow) {
      return null;
    }
    const { data: reactionRows, error: reactionError } = await supabase
      .from("question_reactions")
      .select("type")
      .eq("question_id", questionId);
    if (reactionError) {
      throw new Error(reactionError.message);
    }
    const reactions: Reactions = { like: 0, thanks: 0 };
    for (const row of reactionRows ?? []) {
      reactions[row.type as keyof Reactions] += 1;
    }
    const question = mapQuestion(questionRow);
    question.reactions = reactions;
    return question;
  },
  async addAnswerReaction(
    answerId: string,
    type: keyof Reactions,
    userId: string
  ): Promise<Answer | null> {
    if (useLocal) {
      return localApi.addAnswerReaction(answerId, type, userId);
    }
    const supabase = getSupabase();
    if (!supabase) {
      return localApi.addAnswerReaction(answerId, type, userId);
    }
    const { data: inserted, error: insertError } = await supabase
      .from("answer_reactions")
      .insert([{ answer_id: answerId, user_id: userId, type }])
      .select("id")
      .maybeSingle();
    if (insertError) {
      if (insertError.code === "23505") {
        return null;
      }
      throw new Error(insertError.message);
    }
    if (!inserted) {
      return null;
    }
    const { data: answerRow, error: answerError } = await supabase
      .from("answers")
      .select("*")
      .eq("id", answerId)
      .maybeSingle();
    if (answerError) {
      throw new Error(answerError.message);
    }
    if (!answerRow) {
      return null;
    }
    const { data: reactionRows, error: reactionError } = await supabase
      .from("answer_reactions")
      .select("type")
      .eq("answer_id", answerId);
    if (reactionError) {
      throw new Error(reactionError.message);
    }
    const reactions: Reactions = { like: 0, thanks: 0 };
    for (const row of reactionRows ?? []) {
      reactions[row.type as keyof Reactions] += 1;
    }
    return { ...mapAnswer(answerRow), reactions };
  },
  async getProfile(): Promise<Profile> {
    return localApi.getProfile();
  },
  async addXp(amount: number): Promise<Profile> {
    return localApi.addXp(amount);
  },
};
