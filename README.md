# 4T1J Dota 2 site

React + Vite site for the 4T1J esports team.

## Player IDs
- Артем — 127394881
- Ильшат — 1585608718
- Костя — 129692343
- Кирилл — 421012634
- Инсаф — 237813481

## Live statistics
Player profiles request data from OpenDota API in the browser. The profile page includes W/L, Winrate, K/D/A averages, GPM, XPM, CS, favorite heroes, recent matches and links to Steam, Dotabuff, D2PT and OpenDota.

The browser caches profile data for 5 minutes. Use "ОБНОВИТЬ ДАННЫЕ" to force a refresh.

## Run
```bash
npm install
npm run dev
```

## GitHub Pages
The Vite base path is `/` for the custom domain `4t1j.ru`.


## Draft Simulator (новая страница `/draft`)

В текущий сайт 4T1J добавлен тренажёр драфта:
- комната по короткому коду и пригласительной ссылке;
- создатель комнаты играет за Radiant;
- друг может присоединиться капитаном Dire;
- остальные могут зайти наблюдателями;
- выбор героев и банов по очереди;
- список героев загружается из OpenDota, есть резервный список;
- состояние комнаты обновляется опросом Supabase примерно раз в 1,8 секунды.

### Подключение комнаты
1. В Supabase открой SQL Editor и выполни `supabase-draft-rooms.sql`.
2. В GitHub Actions должны быть заданы уже используемые сайтом секреты:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Запусти workflow Deploy или отправь коммит в `main`.
4. Открой `https://4t1j.ru/draft` (если домен подключён) или страницу `/draft` на текущем домене.

### Важно
Таблица и политики из `supabase-draft-rooms.sql` открыты для первоначального тестирования. Это не безопасная production-конфигурация: пользователь с публичным ключом может читать и изменять состояние комнат, а проверка очереди выполняется в браузере. Перед публичным запуском нужно добавить серверную проверку ходов и авторизацию/проверку членства комнаты. Пока в Draft Simulator не показывается процент победы — его добавим отдельным этапом на основе исторических матчей.
