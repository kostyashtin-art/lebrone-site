# 4T1J — исправление /admin

В проекте используется React Router с GitHub Pages.

## Важно

После `npm run build` автоматически создаётся `dist/404.html`. Благодаря этому GitHub Pages отдаёт приложение и для прямого адреса:

`https://4t1j.ru/admin`

Не нужно переходить на `/#/admin`.

## После загрузки проекта в GitHub

1. Загрузите содержимое папки `project` в репозиторий `lebrone-site`.
2. Сделайте Commit.
3. Откройте Actions → последний workflow `Deploy React + Vite to GitHub Pages`.
4. Дождитесь статуса зелёный `Success`.
5. Откройте `https://4t1j.ru/admin`.
6. Если браузер всё ещё показывает старую 404, сделайте Ctrl+F5.

## Если после исправления открывается сама админка, но просит Supabase

Это уже не ошибка маршрута. Нужно добавить в GitHub:

Settings → Secrets and variables → Actions → Secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Вставляются только публичный URL проекта Supabase и publishable key. Service Role Key на сайт не добавляется.
