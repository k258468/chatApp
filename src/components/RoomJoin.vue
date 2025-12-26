<script setup lang="ts">
import { ref } from "vue";

import type { Role } from "../types";

const props = defineProps<{
  role: Role;
}>();

const emit = defineEmits<{
  (e: "join", payload: { code: string; taKey?: string }): void;
}>();

const code = ref("");
const taKey = ref("");

const parseCode = (input: string) => {
  try {
    const url = new URL(input);
    const param = url.searchParams.get("room");
    return param ? param.toUpperCase() : input.toUpperCase();
  } catch {
    return input.toUpperCase();
  }
};

const submit = () => {
  const value = parseCode(code.value.trim());
  if (!value) {
    return;
  }
  emit("join", { code: value, taKey: taKey.value.trim() || undefined });
};
</script>

<template>
  <section class="card">
    <div class="card-header">
      <p class="eyebrow">Student Entry</p>
      <h2>ルームに参加</h2>
      <p class="sub">QRコードかURLからも参加できます。</p>
    </div>
    <form class="form" @submit.prevent="submit">
      <label>
        <span>ルームコード / 参加URL</span>
        <input v-model="code" type="text" placeholder="例: X7K9Q2 または https://..." />
      </label>
      <label v-if="props.role === 'ta'">
        <span>TA表示キー</span>
        <input v-model="taKey" type="text" placeholder="教員から共有されたキー" />
      </label>
      <button class="primary" type="submit">参加する</button>
      <p class="hint">
        {{ props.role === "ta" ? "TAキーが必要です。" : "教員が表示しているコードを入力してください。" }}
      </p>
    </form>
  </section>
</template>

<style scoped>
.card {
  padding: 28px;
  border-radius: 24px;
  background: var(--panel);
  box-shadow: var(--shadow);
  border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
}

.card-header h2 {
  margin: 6px 0 8px;
  font-size: 24px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 12px;
  color: var(--ink-muted);
}

.sub {
  color: var(--ink-muted);
  margin-bottom: 20px;
}

.form {
  display: grid;
  gap: 16px;
}

label span {
  display: block;
  font-size: 13px;
  color: var(--ink-muted);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(31, 41, 55, 0.12);
  font-size: 14px;
  background: white;
}

.primary {
  background: var(--accent);
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.primary:hover {
  transform: translateY(-2px);
}

.hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ink-muted);
}
</style>
