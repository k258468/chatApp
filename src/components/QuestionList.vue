<script setup lang="ts">
import type { Question, Reactions, Role } from "../types";

defineProps<{
  role: Role;
  questions: Question[];
}>();

const emit = defineEmits<{
  (e: "resolve", payload: { questionId: string }): void;
  (e: "reopen", payload: { questionId: string }): void;
  (e: "react", payload: { questionId: string; type: keyof Reactions }): void;
}>();

const statusLabel = (status: string) => (status === "resolved" ? "回答済み" : "受付中");
</script>

<template>
  <div class="list">
    <div
      v-for="(question, index) in questions"
      :key="question.id"
      class="item"
      :class="{ resolved: question.status === 'resolved' }"
      :style="{ animationDelay: `${index * 40}ms` }"
    >
      <div class="meta">
        <span class="badge" :class="question.status">{{ statusLabel(question.status) }}</span>
        <span class="time">{{ new Date(question.createdAt).toLocaleTimeString() }}</span>
      </div>
      <p class="text">{{ question.text }}</p>
      <div class="footer">
        <span v-if="question.anonymous" class="author">匿名</span>
        <span v-else-if="question.author" class="author">{{ question.author }}</span>
        <span v-else class="author">名無し</span>
        <div class="actions">
          <button
            class="reaction"
            @click="emit('react', { questionId: question.id, type: 'like' })"
          >
            いいね {{ question.reactions.like }}
          </button>
          <button
            class="reaction"
            @click="emit('react', { questionId: question.id, type: 'thanks' })"
          >
            参考になった {{ question.reactions.thanks }}
          </button>
          <button
            v-if="(role === 'teacher' || role === 'ta') && question.status === 'open'"
            class="action"
            @click="emit('resolve', { questionId: question.id })"
          >
            回答済み
          </button>
          <button
            v-if="(role === 'teacher' || role === 'ta') && question.status === 'resolved'"
            class="action ghost"
            @click="emit('reopen', { questionId: question.id })"
          >
            再オープン
          </button>
        </div>
      </div>
    </div>
    <p v-if="questions.length === 0" class="empty">まだ質問がありません。</p>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: 14px;
}

.item {
  padding: 16px 18px;
  border-radius: 18px;
  background: white;
  border: 1px solid rgba(31, 41, 55, 0.08);
  animation: rise 0.4s ease both;
}

.item.resolved {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
}

.meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 8px;
}

.badge {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.badge.open {
  color: var(--accent-strong);
}

.badge.resolved {
  color: #059669;
}

.text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
  margin-bottom: 12px;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--ink-muted);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.reaction {
  border: 1px solid rgba(31, 41, 55, 0.15);
  background: white;
  color: var(--ink);
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.action {
  border: none;
  background: var(--ink);
  color: white;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}

.action.ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid rgba(31, 41, 55, 0.2);
}

.empty {
  text-align: center;
  color: var(--ink-muted);
  padding: 24px 0;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
