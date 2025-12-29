<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import type { Profile, Question, Reactions, Room, Role } from "../types";
import QuestionList from "./QuestionList.vue";

const props = defineProps<{
  room: Room;
  role: Role;
  questions: Question[];
  profile: Profile;
  loading: boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "exit"): void;
  (e: "submit", payload: { text: string; author?: string; anonymous?: boolean }): void;
  (e: "resolve", payload: { questionId: string }): void;
  (e: "reopen", payload: { questionId: string }): void;
  (e: "react", payload: { questionId: string; type: keyof Reactions }): void;
  (e: "react-answer", payload: { answerId: string; type: keyof Reactions }): void;
  (e: "reply", payload: { questionId: string; text: string }): void;
}>();

const text = ref("");
const author = ref("");
const anonymous = ref(false);
const qrCode = ref<string | null>(null);
const helper = ref("");

const joinUrl = computed(() => {
  return `${window.location.origin}/?room=${props.room.code}`;
});

const openCount = computed(
  () => props.questions.filter((question) => question.status === "open").length
);
const resolvedCount = computed(
  () => props.questions.filter((question) => question.status === "resolved").length
);
const roleLabel = computed(() => {
  if (props.role === "teacher") return "教員";
  if (props.role === "ta") return "TA";
  return "学生";
});

watch(
  () => props.room.code,
  async () => {
    qrCode.value = await QRCode.toDataURL(joinUrl.value, {
      margin: 1,
      width: 180,
      color: { dark: "#111827", light: "#ffffff" },
    });
  },
  { immediate: true }
);

const submit = () => {
  if (!text.value.trim()) {
    return;
  }
  emit("submit", {
    text: text.value.trim(),
    author: anonymous.value ? undefined : author.value.trim() || undefined,
    anonymous: anonymous.value,
  });
  text.value = "";
};

const templates = [
  {
    label: "式変形の確認",
    value: "どこで式変形を間違えたか分かりません。途中式を確認したいです。",
  },
  {
    label: "具体例を知りたい",
    value: "この概念の具体例が思い浮かびません。別の例を教えてください。",
  },
  {
    label: "流れがつながらない",
    value: "ここまでの流れがつながりません。要点を短くまとめてください。",
  },
];

const applyTemplate = (value: string) => {
  text.value = value;
};

const applyHelper = () => {
  if (!helper.value.trim()) {
    helper.value = "音声メモ: いまの説明を短く書き起こして質問文に整形してほしい。";
  }
  text.value = helper.value.trim();
};
</script>

<template>
  <section class="room">
    <div class="room-header">
      <div>
        <p class="eyebrow">Live Room</p>
        <h2>{{ room.name }}</h2>
        <p class="sub">講義単位で質問を集約しています。</p>
        <p v-if="room.channel" class="sub">メモ: {{ room.channel }}</p>
      </div>
      <button class="ghost" @click="emit('exit')">退出</button>
    </div>
    <div class="stats">
      <div class="stat">
        <span class="label">質問数</span>
        <strong>{{ questions.length }}</strong>
      </div>
      <div class="stat">
        <span class="label">未解決</span>
        <strong>{{ openCount }}</strong>
      </div>
      <div class="stat">
        <span class="label">納得</span>
        <strong>{{ resolvedCount }}</strong>
      </div>
      <div class="stat role">
        <span class="label">あなたの役割</span>
        <strong>{{ roleLabel }}</strong>
      </div>
    </div>
    <div class="grid">
      <div class="panel">
        <div class="panel-header">
          <h3>質問を投稿</h3>
          <button class="ghost" @click="emit('refresh')">更新</button>
        </div>
        <form class="form" @submit.prevent="submit">
          <label>
            <span>質問内容</span>
            <textarea
              v-model="text"
              rows="3"
              placeholder="詰まっているポイントを具体的に書いてください"
            />
          </label>
          <div class="helper">
            <span>質問テンプレ</span>
            <div class="helper-buttons">
              <button
                v-for="item in templates"
                :key="item.label"
                type="button"
                class="helper-btn"
                @click="applyTemplate(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
          <div class="helper">
            <span>AI文字起こし (ダミー)</span>
            <textarea
              v-model="helper"
              rows="2"
              placeholder="音声メモを貼り付ける想定の入力欄"
            />
            <button type="button" class="ghost small" @click="applyHelper">
              AIで質問文に整形
            </button>
          </div>
          <label>
            <span>ニックネーム (任意)</span>
            <input v-model="author" type="text" placeholder="例: Aki" :disabled="anonymous" />
          </label>
          <label class="checkbox">
            <input v-model="anonymous" type="checkbox" />
            匿名で投稿する
          </label>
          <button class="primary" type="submit" :disabled="loading">
            投稿する
          </button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3>参加導線</h3>
          <span class="code">Code: {{ room.code }}</span>
        </div>
        <div class="qr">
          <img v-if="qrCode" :src="qrCode" alt="QR Code" />
          <div class="link">
            <span>URL</span>
            <input :value="joinUrl" readonly />
          </div>
          <div v-if="role === 'teacher' && room.taKey" class="link">
            <span>TA表示キー</span>
            <input :value="room.taKey" readonly />
          </div>
        </div>
      </div>
    </div>
    <div v-if="role !== 'teacher'" class="panel grow-panel">
      <div class="panel-header">
        <h3>育成ボード</h3>
        <span class="code">XP: {{ profile.xp }} / Lv.{{ profile.level }}</span>
      </div>
      <div class="grow-content">
        <div class="avatar" :class="`stage-${profile.avatarStage}`"></div>
        <div>
          <p class="sub">投稿すると経験値が増え、レベルでアイコンが変化します。</p>
          <div class="levels">
            <span>Lv.1-2</span>
            <span>Lv.3-6</span>
            <span>Lv.7-11</span>
            <span>Lv.12+</span>
          </div>
        </div>
      </div>
    </div>
    <div class="panel list-panel">
      <div class="panel-header">
        <h3>質問一覧</h3>
        <p class="sub">量と内容から詰まりを検知します。</p>
      </div>
      <QuestionList
        :role="role"
        :questions="questions"
        :current-user-id="currentUserId"
        @resolve="emit('resolve', $event)"
        @reopen="emit('reopen', $event)"
        @react="emit('react', $event)"
        @react-answer="emit('react-answer', $event)"
        @reply="emit('reply', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.room {
  display: grid;
  gap: 20px;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.room-header h2 {
  font-size: 30px;
  margin: 6px 0 4px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat {
  padding: 14px 16px;
  border-radius: 16px;
  background: white;
  border: 1px solid rgba(31, 41, 55, 0.08);
}

.stat strong {
  display: block;
  font-size: 22px;
  margin-top: 4px;
}

.stat.role strong {
  font-size: 18px;
  letter-spacing: 0.08em;
}

.label {
  font-size: 12px;
  color: var(--ink-muted);
}

.grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.panel {
  padding: 20px;
  border-radius: 20px;
  background: var(--panel);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--shadow-soft);
}

.list-panel {
  background: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
}

.form {
  display: grid;
  gap: 12px;
}

label span {
  display: block;
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 6px;
}

textarea,
input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(31, 41, 55, 0.12);
  font-size: 14px;
}

.primary {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost {
  border: 1px solid rgba(31, 41, 55, 0.2);
  background: transparent;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}

.ghost.small {
  padding: 6px 10px;
  font-size: 12px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink-muted);
}

.helper {
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-muted);
}

.helper-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.helper-btn {
  border: 1px solid rgba(31, 41, 55, 0.2);
  background: white;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}

.grow-panel {
  background: linear-gradient(120deg, rgba(37, 99, 235, 0.1), rgba(16, 185, 129, 0.08));
}

.grow-content {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  align-items: center;
}

.avatar {
  width: 110px;
  height: 110px;
  border-radius: 28px;
  background: linear-gradient(135deg, #c7d2fe, #93c5fd);
  position: relative;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.7);
}

.avatar::after {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
}

.avatar.stage-1 {
  background: linear-gradient(135deg, #fde68a, #f59e0b);
}

.avatar.stage-2 {
  background: linear-gradient(135deg, #6ee7b7, #34d399);
}

.avatar.stage-3 {
  background: linear-gradient(135deg, #fca5a5, #f97316);
}

.levels {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 8px;
  font-size: 12px;
  color: var(--ink-muted);
}

.qr {
  display: grid;
  gap: 12px;
  justify-items: center;
}

.qr img {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: white;
  padding: 10px;
  border: 1px solid rgba(31, 41, 55, 0.08);
}

.code {
  font-size: 12px;
  color: var(--ink-muted);
}

.link {
  width: 100%;
}

.link span {
  display: block;
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 6px;
}

.sub {
  font-size: 12px;
  color: var(--ink-muted);
}
</style>
