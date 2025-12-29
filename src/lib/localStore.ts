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
  users: Array<UserAccount & { password: string }>;
  memberships: Array<{ userId: string; roomId: string; joinedAt: string }>;
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
      memberships: [],
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
      memberships: parsed.memberships ?? [],
      currentUserId: parsed.currentUserId,
    };
  } catch {
    return {
      rooms: [],
      questions: [],
      profile: { xp: 0, level: 1, avatarStage: 0 },
      users: [],
      memberships: [],
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
  async registerUser(
    name: string,
    role: Role,
    email: string,
    password: string
  ): Promise<UserAccount> {
    const store = loadStore();
    const existing = store.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      store.currentUserId = existing.id;
      saveStore(store);
      const { password: _password, ...user } = existing;
      return user;
    }
    const user = { id: makeId(), name, role, email, password };
    store.users.push(user);
    store.currentUserId = user.id;
    saveStore(store);
    const { password: _password, ...account } = user;
    return account;
  },
  async loginUser(email: string, password: string): Promise<UserAccount | null> {
    const store = loadStore();
    const user = store.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      return null;
    }
    store.currentUserId = user.id;
    saveStore(store);
    const { password: _password, ...account } = user;
    return account;
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
    const user = store.users.find((entry) => entry.id === store.currentUserId);
    if (!user) {
      return null;
    }
    const { password: _password, ...account } = user;
    return account;
  },
  async listJoinedRooms(): Promise<Room[]> {
    const store = loadStore();
    if (!store.currentUserId) {
      return [];
    }
    const roomIds = new Set(
      store.memberships
        .filter((member) => member.userId === store.currentUserId)
        .map((member) => member.roomId)
    );
    return store.rooms.filter((room) => roomIds.has(room.id));
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
    if (store.currentUserId) {
      store.memberships.unshift({
        userId: store.currentUserId,
        roomId: room.id,
        joinedAt: new Date().toISOString(),
      });
    }
    saveStore(store);
    return room;
  },
  async joinRoom(code: string): Promise<Room | null> {
    const store = loadStore();
    const room = store.rooms.find((entry) => entry.code === code) ?? null;
    if (room && store.currentUserId) {
      const exists = store.memberships.some(
        (member) => member.userId === store.currentUserId && member.roomId === room.id
      );
      if (!exists) {
        store.memberships.unshift({
          userId: store.currentUserId,
          roomId: room.id,
          joinedAt: new Date().toISOString(),
        });
        saveStore(store);
      }
    }
    return room;
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
