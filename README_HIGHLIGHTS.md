# 4T1J Highlights + Admin

В проект добавлена система хайлайтов:

- `/highlights` — публичная страница видео;
- `/admin` — закрытая админ-панель;
- загрузка MP4/WebM;
- загрузка превью;
- игрок + герой + название + описание;
- featured / публикация / скрытие / удаление;
- мобильная версия;
- Supabase Auth + Database + Storage.

## Подключение Supabase

1. Создай проект Supabase.
2. В SQL Editor выполни `supabase-schema.sql`.
3. Создай пользователя в Authentication → Users.
4. Скопируй `.env.example` в `.env` и заполни:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Используй только публичный anon/publishable key. Service-role key в сайт не добавляй.

## GitHub Pages

Для GitHub Actions добавь в Repository → Settings → Secrets and variables → Actions → Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Workflow должен передавать эти значения в build через env.

## Важно про большие видео

GitHub Pages не хранит MP4. Видео уходят в Supabase Storage, а в таблице `highlights` сохраняется только публичный URL и метаданные.
