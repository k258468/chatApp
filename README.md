# Lecture Q&A Pulse (Vue + TypeScript)

学生が教員に質問できる講義中Q&Aアプリの最小構成プロトタイプです。

## 目的
- 質問量・内容で詰まりを検知して理解度を見える化
- 多人数授業でも質問をチャンネル単位で集約
- 納得マークで回答の伝達状況を確認
- Q&Aを資産化し次回以降の講義改善に活用
- 投稿回数で経験値がたまり、レベルでアイコンが変化
- 匿名投稿・リアクションで心理的ハードルを下げる

## ローカル実行
```bash
npm install
npm run dev
```

## Supabase 接続
`.env` を作成して以下を設定してください。
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Supabase 未設定の場合はローカルストレージに保存します。
ローカル強制の場合は `VITE_USE_LOCAL=true` を設定してください。

## アカウント管理 (ローカル)
- 初回ログイン画面で学生/教員を選択して登録します。
- 以降は同じ表示名 + 役割でログインできます。
- 簡易仕様のためパスワードなしです（Supabase Auth 連携で拡張可能）。

### 推奨テーブル
```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique default upper(substr(md5(random()::text), 1, 6)),
  name text not null,
  channel text,
  ta_key text,
  created_at timestamptz default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  text text not null,
  status text default 'open',
  author text,
  anonymous boolean default false,
  reactions jsonb default '{"like":0,"thanks":0}',
  created_at timestamptz default now()
);
```

## ルーム参加
- 教員がルーム生成
- 学生はコード/URL/QR から参加

## 想定拡張
- 教員認証 (Supabase Auth + RLS)
- チャンネルの階層化
- 質問のタグや投票
