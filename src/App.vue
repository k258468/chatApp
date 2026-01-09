<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Profile, Question, Role, Room, UserAccount } from "./types";
import { dataApi } from "./lib/data";
import AuthPanel from "./components/AuthPanel.vue";
import RoomCreate from "./components/RoomCreate.vue";
import RoomJoin from "./components/RoomJoin.vue";
import RoomHistory from "./components/RoomHistory.vue";
import RoomView from "./components/RoomView.vue";

const currentUser = ref<UserAccount | null>(null);
const role = computed<Role>(() => currentUser.value?.role ?? "student");
const room = ref<Room | null>(null);
const questions = ref<Question[]>([]);
const joinedRooms = ref<Room[]>([]);
const profile = ref<Profile>({ xp: 0, level: 1, avatarStage: 0 });
const loading = ref(false);
const error = ref<string | null>(null);
const pendingJoinCode = ref<string | null>(null);

const setError = (message: string | null) => {
  error.value = message;
  if (message) {
    setTimeout(() => {
      if (error.value === message) {
        error.value = null;
      }
    }, 4000);
  }
};

const handleLogin = async (payload: { email: string; password: string }) => {
  loading.value = true;
  try {
    const user = await dataApi.loginUser(payload.email, payload.password);
    if (!user) {
      setError("ログインに失敗しました。入力内容を確認してください。");
      return;
    }
    currentUser.value = user;
    joinedRooms.value = await dataApi.listJoinedRooms();
    if (pendingJoinCode.value) {
      const code = pendingJoinCode.value;
      pendingJoinCode.value = null;
      await handleJoinRoom({ code });
    }
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleRegister = async (payload: {
  name: string;
  role: Role;
  email: string;
  password: string;
}) => {
  loading.value = true;
  try {
    currentUser.value = await dataApi.registerUser(
      payload.name,
      payload.role,
      payload.email,
      payload.password
    );
    joinedRooms.value = await dataApi.listJoinedRooms();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleLogout = async () => {
  await dataApi.logoutUser();
  currentUser.value = null;
  room.value = null;
  questions.value = [];
  joinedRooms.value = [];
};

const handleCreateRoom = async (payload: {
  name: string;
  channel: string;
  taKey?: string;
}) => {
  loading.value = true;
  try {
    room.value = await dataApi.createRoom(payload.name, payload.channel, payload.taKey);
    joinedRooms.value = await dataApi.listJoinedRooms();
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleJoinRoom = async (payload: { code: string; taKey?: string }) => {
  loading.value = true;
  try {
    const joined = await dataApi.joinRoom(payload.code);
    if (!joined) {
      setError("ルームが見つかりませんでした。");
      return;
    }
    if (role.value === "ta" && joined.taKey && joined.taKey !== payload.taKey) {
      setError("TA表示キーが一致しません。");
      return;
    }
    room.value = joined;
    joinedRooms.value = await dataApi.listJoinedRooms();
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const refreshQuestions = async (options?: { silent?: boolean }) => {
  if (!room.value) {
    return;
  }
  if (!options?.silent) {
    loading.value = true;
  }
  try {
    questions.value = await dataApi.listQuestions(room.value.id);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    if (!options?.silent) {
      loading.value = false;
    }
  }
};

const handleSubmitQuestion = async (payload: { text: string; anonymous?: boolean }) => {
  if (!room.value) {
    return;
  }
  loading.value = true;
  try {
    const author = payload.anonymous ? undefined : currentUser.value?.name;
    await dataApi.createQuestion(
      room.value.id,
      payload.text,
      author,
      payload.anonymous,
      currentUser.value?.id
    );
    if (role.value !== "teacher") {
      profile.value = await dataApi.addXp(12);
    }
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleResolve = async (payload: { questionId: string }) => {
  loading.value = true;
  try {
    await dataApi.updateQuestionStatus(payload.questionId, "resolved");
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleReopen = async (payload: { questionId: string }) => {
  loading.value = true;
  try {
    await dataApi.updateQuestionStatus(payload.questionId, "open");
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleReact = async (payload: { questionId: string; type: "like" | "thanks" }) => {
  try {
    if (!currentUser.value) {
      setError("ログインが必要です。");
      return;
    }
    const updated = await dataApi.addQuestionReaction(
      payload.questionId,
      payload.type,
      currentUser.value.id
    );
    if (!updated) {
      await refreshQuestions({ silent: true });
      return;
    }
    questions.value = questions.value.map((question) =>
      question.id === updated.id ? { ...question, reactions: updated.reactions } : question
    );
    await refreshQuestions({ silent: true });
  } catch (err) {
    setError((err as Error).message);
  }
};

const handleAnswerReact = async (payload: { answerId: string; type: "like" | "thanks" }) => {
  try {
    if (!currentUser.value) {
      setError("ログインが必要です。");
      return;
    }
    const updated = await dataApi.addAnswerReaction(
      payload.answerId,
      payload.type,
      currentUser.value.id
    );
    if (!updated) {
      await refreshQuestions({ silent: true });
      return;
    }
    questions.value = questions.value.map((question) => ({
      ...question,
      answers: question.answers.map((answer) =>
        answer.id === updated.id ? { ...answer, reactions: updated.reactions } : answer
      ),
    }));
    await refreshQuestions({ silent: true });
  } catch (err) {
    setError((err as Error).message);
  }
};

const handleReply = async (payload: {
  questionId: string;
  text: string;
  anonymous?: boolean;
}) => {
  loading.value = true;
  try {
    const author = payload.anonymous ? "匿名" : currentUser.value?.name ?? "匿名";
    const roleValue = currentUser.value?.role ?? "student";
    const ownerId = currentUser.value?.id;
    const answer = await dataApi.createAnswer(
      payload.questionId,
      payload.text,
      author,
      roleValue,
      ownerId
    );
    questions.value = questions.value.map((question) =>
      question.id === payload.questionId
        ? { ...question, answers: [...question.answers, answer] }
        : question
    );
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleDeleteQuestion = async (payload: { questionId: string }) => {
  if (!confirm("この質問を削除しますか？")) {
    return;
  }
  loading.value = true;
  try {
    await dataApi.deleteQuestion(payload.questionId);
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const handleDeleteAnswer = async (payload: { answerId: string }) => {
  if (!confirm("この返信を削除しますか？")) {
    return;
  }
  loading.value = true;
  try {
    await dataApi.deleteAnswer(payload.answerId);
    await refreshQuestions();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const exitRoom = () => {
  room.value = null;
  questions.value = [];
};

const handleOpenRoom = async (target: Room) => {
  room.value = target;
  await refreshQuestions();
};

const pulseMessage = computed(() => {
  const openCount = questions.value.filter((question) => question.status === "open").length;
  if (openCount >= 10) {
    return "詰まり多発: 重点解説ゾーン";
  }
  if (openCount >= 5) {
    return "詰まり兆候: 速度を少し落とす";
  }
  return "理解は順調";
});

onMounted(() => {
  dataApi.getCurrentUser().then((value) => {
    currentUser.value = value;
    if (value) {
      dataApi.listJoinedRooms().then((rooms) => {
        joinedRooms.value = rooms;
      });
      if (pendingJoinCode.value) {
        const code = pendingJoinCode.value;
        pendingJoinCode.value = null;
        handleJoinRoom({ code });
      }
    }
  });
  dataApi.getProfile().then((value) => {
    profile.value = value;
  });
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  if (code && currentUser.value) {
    handleJoinRoom({ code: code.toUpperCase() });
  } else if (code) {
    pendingJoinCode.value = code.toUpperCase();
  }
});

let refreshTimer: number | null = null;
const startPolling = () => {
  if (refreshTimer) {
    return;
  }
  refreshTimer = window.setInterval(() => {
    if (room.value) {
      refreshQuestions({ silent: true });
    }
  }, 5000);
};

const stopPolling = () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

watch(room, (value) => {
  if (value) {
    refreshQuestions();
    startPolling();
  } else {
    stopPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">Lecture Interaction</p>
        <h1>Lecture Q&A Pulse</h1>
        <p class="lead">
          講義中の質問を集約し、理解度の“見える化”で双方向性を高める。
        </p>
      </div>
      <div class="pulse">
        <p class="pulse-label">理解度インジケータ</p>
        <strong>{{ pulseMessage }}</strong>
      </div>
    </header>

    <main>
      <section class="content">
        <AuthPanel v-if="!currentUser" @login="handleLogin" @register="handleRegister" />
        <div v-else class="account-bar">
          <div>
            <p class="eyebrow">Signed in</p>
            <p class="account-name">
              {{ currentUser.name }} / {{ role === "teacher" ? "教員" : "学生" }}
            </p>
          </div>
          <button class="ghost" @click="handleLogout">ログアウト</button>
        </div>
        <RoomHistory
          v-if="currentUser && !room"
          :rooms="joinedRooms"
          @open="handleOpenRoom"
        />
        <RoomCreate v-if="currentUser && role === 'teacher' && !room" @create="handleCreateRoom" />
        <RoomJoin v-if="currentUser && !room" :role="role" @join="handleJoinRoom" />
        <RoomView
          v-if="currentUser && room"
          :room="room"
          :role="role"
          :questions="questions"
          :profile="profile"
          :loading="loading"
          :current-user-id="currentUser?.id"
          @refresh="refreshQuestions"
          @exit="exitRoom"
          @submit="handleSubmitQuestion"
          @resolve="handleResolve"
          @reopen="handleReopen"
          @react="handleReact"
          @react-answer="handleAnswerReact"
          @reply="handleReply"
          @delete-question="handleDeleteQuestion"
          @delete-answer="handleDeleteAnswer"
        />
      </section>
    </main>

    <div v-if="error" class="toast">{{ error }}</div>
  </div>
</template>

<style>
:root {
  color-scheme: light;
  font-family: "Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo",
    sans-serif;
  --ink: #111827;
  --ink-muted: rgba(17, 24, 39, 0.6);
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --panel: rgba(255, 255, 255, 0.72);
  --shadow: 0 22px 60px rgba(15, 23, 42, 0.12);
  --shadow-soft: 0 16px 50px rgba(15, 23, 42, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: radial-gradient(circle at top, #e0f2fe 0%, transparent 55%),
    radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.2), transparent 45%),
    linear-gradient(120deg, #fff7ed 0%, #f8fafc 50%, #eff6ff 100%);
  min-height: 100vh;
  color: var(--ink);
}

a {
  color: inherit;
}

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 24px 64px;
  display: grid;
  gap: 32px;
  animation: fadeIn 0.6s ease;
}

.hero {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  align-items: end;
}

.hero h1 {
  font-size: clamp(32px, 4vw, 46px);
  margin: 6px 0 10px;
}

.lead {
  font-size: 16px;
  color: var(--ink-muted);
  max-width: 520px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 11px;
  color: var(--ink-muted);
}

.pulse {
  padding: 18px 20px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.85);
  color: white;
  box-shadow: var(--shadow);
}

.pulse-label {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
}

.role-panel {
  display: grid;
  gap: 12px;
}

.role-toggle {
  display: inline-flex;
  background: white;
  padding: 6px;
  border-radius: 999px;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(31, 41, 55, 0.08);
}

.role-toggle button {
  border: none;
  background: transparent;
  padding: 10px 20px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  color: var(--ink-muted);
}

.role-toggle button.active {
  background: var(--accent);
  color: white;
}

.role-note {
  color: var(--ink-muted);
  margin: 0;
}

.content {
  display: grid;
  gap: 24px;
  animation: rise 0.5s ease both;
}

.account-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 18px;
  background: white;
  border: 1px solid rgba(31, 41, 55, 0.08);
  box-shadow: var(--shadow-soft);
}

.account-name {
  margin: 4px 0 0;
  font-weight: 600;
}

.toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  background: #111827;
  color: white;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 13px;
  box-shadow: var(--shadow);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 720px) {
  .page {
    padding: 32px 18px 48px;
  }
  .hero {
    grid-template-columns: 1fr;
  }
}
</style>
