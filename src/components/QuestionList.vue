<script setup lang="ts">
import { ref } from "vue";
import type { Question, Reactions, Role } from "../types";

const props = defineProps<{
  role: Role;
  questions: Question[];
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "resolve", payload: { questionId: string }): void;
  (e: "reopen", payload: { questionId: string }): void;
  (e: "react", payload: { questionId: string; type: keyof Reactions }): void;
  (e: "react-answer", payload: { answerId: string; type: keyof Reactions }): void;
  (e: "reply", payload: { questionId: string; text: string; anonymous?: boolean }): void;
  (e: "delete-question", payload: { questionId: string }): void;
  (e: "delete-answer", payload: { answerId: string }): void;
}>();

const statusLabel = (status: string) => (status === "resolved" ? "回答済み" : "受付中");
const replyText = ref<Record<string, string>>({});
const replyAnonymous = ref<Record<string, boolean>>({});
const roleLabel = (role: Role) => {
  if (role === "teacher") return "教員";
  if (role === "ta") return "TA";
  return "学生";
};
const canDeleteQuestion = (question: Question) =>
  (props.role === "student" && question.ownerId === props.currentUserId) ||
  props.role === "teacher" ||
  props.role === "ta";
const canDeleteAnswer = (answer: Question["answers"][number]) =>
  (props.role === "student" && answer.ownerId === props.currentUserId) ||
  props.role === "teacher" ||
  props.role === "ta";

const submitReply = (questionId: string) => {
  const text = replyText.value[questionId]?.trim();
  if (!text) {
    return;
  }
  emit("reply", { questionId, text, anonymous: replyAnonymous.value[questionId] });
  replyText.value[questionId] = "";
  replyAnonymous.value[questionId] = false;
};
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
      <div v-if="question.answers.length" class="answers">
        <div v-for="answer in question.answers" :key="answer.id" class="answer">
          <div class="answer-meta">
            <span class="answer-author">{{ answer.author || "匿名" }}</span>
            <span class="answer-role">{{ roleLabel(answer.role) }}</span>
            <span class="time">{{ new Date(answer.createdAt).toLocaleTimeString() }}</span>
          </div>
          <p class="answer-text">{{ answer.text }}</p>
          <div class="answer-actions">
            <button
              class="reaction"
              @click="emit('react-answer', { answerId: answer.id, type: 'like' })"
            >
              いいね {{ answer.reactions.like }}
            </button>
            <button
              class="reaction"
              @click="emit('react-answer', { answerId: answer.id, type: 'thanks' })"
            >
              参考になった {{ answer.reactions.thanks }}
            </button>
            <button
              v-if="canDeleteAnswer(answer)"
              class="action danger"
              @click="emit('delete-answer', { answerId: answer.id })"
            >
              返信削除
            </button>
          </div>
        </div>
      </div>
      <div class="reply">
        <input
          v-model="replyText[question.id]"
          type="text"
          placeholder="回答・返信を入力"
        />
        <button class="reply-btn" type="button" @click="submitReply(question.id)">
          返信
        </button>
      </div>
      <label class="reply-anon">
        <input v-model="replyAnonymous[question.id]" type="checkbox" />
        匿名で返信する
      </label>
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
          <template v-if="role === 'student' && question.ownerId === props.currentUserId">
            <button
              v-if="question.status === 'open'"
              class="action ghost"
              @click="emit('resolve', { questionId: question.id })"
            >
              納得
            </button>
            <button
              v-else
              class="action ghost"
              @click="emit('reopen', { questionId: question.id })"
            >
              納得を取り消す
            </button>
          </template>
          <button
            v-if="canDeleteQuestion(question)"
            class="action danger"
            @click="emit('delete-question', { questionId: question.id })"
          >
            質問削除
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

.answers {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.answer {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(31, 41, 55, 0.08);
}

.answer-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: var(--ink-muted);
  margin-bottom: 6px;
}

.answer-author {
  font-weight: 600;
  color: var(--ink);
}

.answer-role {
  padding: 2px 6px;
  border-radius: 999px;
  background: white;
  border: 1px solid rgba(31, 41, 55, 0.12);
}

.answer-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
}

.answer-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.reply {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.reply-anon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 12px;
}

.reply input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(31, 41, 55, 0.12);
  font-size: 13px;
  background: white;
}

.reply-btn {
  border: 1px solid rgba(31, 41, 55, 0.15);
  background: white;
  color: var(--ink);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
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

.action.danger {
  background: #ef4444;
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
