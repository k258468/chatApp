<script setup lang="ts">
import { ref } from "vue";
import type { Role } from "../types";

const emit = defineEmits<{
  (e: "login", payload: { email: string; password: string }): void;
  (e: "register", payload: { name: string; role: Role; email: string; password: string }): void;
}>();

const mode = ref<"login" | "register">("login");
const name = ref("");
const email = ref("");
const password = ref("");
const role = ref<Role>("student");

const submit = () => {
  const trimmedEmail = email.value.trim();
  const trimmedPassword = password.value.trim();
  if (!trimmedEmail || !trimmedPassword) {
    return;
  }
  if (mode.value === "login") {
    emit("login", { email: trimmedEmail, password: trimmedPassword });
  } else {
    const trimmedName = name.value.trim();
    if (!trimmedName) {
      return;
    }
    emit("register", {
      name: trimmedName,
      role: role.value,
      email: trimmedEmail,
      password: trimmedPassword,
    });
  }
};
</script>

<template>
  <section class="card">
    <div class="card-header">
      <p class="eyebrow">Account</p>
      <h2>アカウント管理</h2>
      <p class="sub">学生と教員でアカウントを分けて表示を切り替えます。</p>
    </div>
    <div class="mode-toggle">
      <button :class="{ active: mode === 'login' }" @click="mode = 'login'">ログイン</button>
      <button :class="{ active: mode === 'register' }" @click="mode = 'register'">
        新規登録
      </button>
    </div>
    <form class="form" @submit.prevent="submit">
      <label v-if="mode === 'register'">
        <span>表示名</span>
        <input v-model="name" type="text" placeholder="例: Yuki" />
      </label>
      <label>
        <span>メールアドレス</span>
        <input v-model="email" type="email" placeholder="you@example.com" />
      </label>
      <label v-if="mode === 'register'">
        <span>役割</span>
        <select v-model="role">
          <option value="student">学生</option>
          <option value="teacher">教員</option>
        </select>
      </label>
      <label>
        <span>パスワード</span>
        <input v-model="password" type="password" placeholder="8文字以上推奨" />
      </label>
      <button class="primary" type="submit">
        {{ mode === "login" ? "ログイン" : "登録して続ける" }}
      </button>
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

.mode-toggle {
  display: inline-flex;
  background: white;
  padding: 6px;
  border-radius: 999px;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(31, 41, 55, 0.08);
  margin-bottom: 16px;
}

.mode-toggle button {
  border: none;
  background: transparent;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  color: var(--ink-muted);
}

.mode-toggle button.active {
  background: var(--accent);
  color: white;
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

input,
select {
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
</style>
