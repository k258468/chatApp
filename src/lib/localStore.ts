import type {
  Profile,
  Question,
  QuestionStatus,
  Reactions,
  Room,
  Role,
  UserAccount,
} from "../types";

type StoreShape = {
  rooms: Room[];
  questions: Question[];
  profile: Profile;
  users: UserAccount[];
  currentUserId?: string;
};

const STORAGE_KEY = "lecture-qna-store";

const loadStore = (): StoreShape => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      rooms: [],
      questions: [],
      profile: { xp: 0, level: 1, avatarStage: 0 },
      users: [],
      currentUserId: undefined,
    };
  }
  try {
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      rooms: parsed.rooms ?? [],
      questions: parsed.questions ?? [],
      profile: parsed.profile ?? { xp: 0, level: 1, avatarStage: 0 },
      users: parsed.users ?? [],
      currentUserId: parsed.currentUserId,
    };
  } catch {
    return {
      rooms: [],
      questions: [],
      profile: { xp: 0, level: 1, avatarStage: 0 },
      users: [],
      currentUserId: undefined,
    };
  }
};

const saveStore = (store: StoreShape) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const makeId = () => crypto.randomUUID();

const levelForXp = (xp: number) => Math.floor(xp / 100) + 1;

const avatarForLevel = (level: number) => {
  if (level >= 12) return 3;
  if (level >= 7) return 2;
  if (level >= 3) return 1;
  return 0;
};

const baseReactions = (): Reactions => ({ like: 0, thanks: 0 });

export const localApi = {
  async registerUser(name: string, role: Role): Promise<UserAccount> {
    const store = loadStore();
    const existing = store.users.find(
      (user) => user.name.toLowerCase() === name.toLowerCase() && user.role === role
    );
    if (existing) {
      store.currentUserId = existing.id;
      saveStore(store);
      return existing;
    }
    const user: UserAccount = { id: makeId(), name, role };
    store.users.push(user);
    store.currentUserId = user.id;
    saveStore(store);
    return user;
  },
  async loginUser(name: string, role: Role): Promise<UserAccount | null> {
    const store = loadStore();
    const user = store.users.find(
      (entry) => entry.name.toLowerCase() === name.toLowerCase() && entry.role === role
    );
    if (!user) {
      return null;
    }
    store.currentUserId = user.id;
    saveStore(store);
    return user;
  },
  async logoutUser(): Promise<void> {
    const store = loadStore();
    store.currentUserId = undefined;
    saveStore(store);
  },
  async getCurrentUser(): Promise<UserAccount | null> {
    const store = loadStore();
    if (!store.currentUserId) {
      return null;
    }
    return store.users.find((user) => user.id === store.currentUserId) ?? null;
  },
  async createRoom(name: string, channel: string, taKey?: string): Promise<Room> {
    const store = loadStore();
    const room: Room = {
      id: makeId(),
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      name,
      channel,
      taKey,
      createdAt: new Date().toISOString(),
    };
    store.rooms.unshift(room);
    saveStore(store);
    return room;
  },
  async joinRoom(code: string): Promise<Room | null> {
    const store = loadStore();
    return store.rooms.find((room) => room.code === code) ?? null;
  },
  async listQuestions(roomId: string): Promise<Question[]> {
    const store = loadStore();
    return store.questions
      .filter((question) => question.roomId === roomId)
      .map((question) => ({
        ...question,
        reactions: question.reactions ?? baseReactions(),
      }));
  },
  async createQuestion(
    roomId: string,
    text: string,
    author?: string,
    anonymous?: boolean
  ): Promise<Question> {
    const store = loadStore();
    const question: Question = {
      id: makeId(),
      roomId,
      text,
      status: "open",
      createdAt: new Date().toISOString(),
      author,
      anonymous,
      reactions: baseReactions(),
    };
    store.questions.unshift(question);
    saveStore(store);
    return question;
  },
  async addReaction(
    questionId: string,
    type: keyof Reactions
  ): Promise<Question | null> {
    const store = loadStore();
    const target = store.questions.find((question) => question.id === questionId);
    if (!target) {
      return null;
    }
    if (!target.reactions) {
      target.reactions = baseReactions();
    }
    target.reactions[type] += 1;
    saveStore(store);
    return target;
  },
  async updateQuestionStatus(
    questionId: string,
    status: QuestionStatus
  ): Promise<Question | null> {
    const store = loadStore();
    const target = store.questions.find((question) => question.id === questionId);
    if (!target) {
      return null;
    }
    target.status = status;
    saveStore(store);
    return target;
  },
  async getProfile(): Promise<Profile> {
    const store = loadStore();
    return store.profile;
  },
  async addXp(amount: number): Promise<Profile> {
    const store = loadStore();
    store.profile.xp += amount;
    store.profile.level = levelForXp(store.profile.xp);
    store.profile.avatarStage = avatarForLevel(store.profile.level);
    saveStore(store);
    return store.profile;
  },
};
