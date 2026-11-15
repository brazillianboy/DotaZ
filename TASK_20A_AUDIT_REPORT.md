# DotaZ — Отчёт аудита Task 20A (Steam OpenID 2.0 + интеграция с Supabase Auth)

**Дата:** 2026-11-10
**Тип:** Аудит восстановления и диагностика прерванной правки Edge Function.
**Статус Task 20A:** `in_progress` / **BLOCKED** (реальный Steam-вход и приёмка не выполнялись).
**Источник фактов:** read-only инспекция репозитория, команды проверки (tsc / vitest / build / git diff / curl), разбор исходников и AST, `PLAN.md`, `ARCHITECTURE.md`, `README.md`.

> Сводка: вся локальная проверка приложения проходит (tsc, 63 файла / 1080 тестов, build, git diff), однако **серверная Edge Function `steam-auth` структурно сломана незавершённой правкой** и не зарегистрирует HTTP-обработчик. Staging из текущего окружения недостижим (таймауты), поэтому состояние деплоя не подтверждено.

---

## 1. Диагностика прерывания прошлой сессии Cline

**Что установлено фактически:**

1. **Правка `getAdmin()` не сохранилась.** В кодовой базе **нет** ни `getAdmin`, ни `adminClient` (поиск по 242 файлам — 0 совпадений). В `supabase/functions/steam-auth/index.ts:53` по-прежнему **энергичная (eager)** инициализация:
   `const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: {...} })`.
   То есть ленивая инициализация, о которой шла речь, либо откачена, либо не была записана на диск.

2. **Сохранился явный артефакт незавершённой правки в том же файле.** Функция `timingSafeEqual` (строки 138–146) **не имеет закрывающей `}`**:
   - строки 138–146: `function timingSafeEqual(...) { if (...) { return false } let diff = 0; for (...) { ... } return diff === 0` — и после строки 146 **закрывающая скобка отсутствует** (строка 147 пустая).

3. **Проверка компилятором TypeScript (AST):**
   - `SYNTAX_DIAGNOSTICS = 0` — файл **синтаксически валиден** (объявления после `return` допустимы), поэтому tsc/esbuild его не отметят как ошибку;
   - `timingSafeEqual` занимает позиции **4959 → 23386**, то есть простирается до конца файла (SourceFile end = 23388);
   - `Deno.serve` на позиции **22307** → `Deno.serve INSIDE timingSafeEqual = true`.

   После `return diff === 0` весь остальной модуль (`StatePayload`, `encodeState`, `decodeState`, `nonceStore`, `exchangeStore`, `gateway`, `loadSteamProfile`, rate-limit, `missingConfig`, все `handle*` и `Deno.serve(...)`) оказался вложенным **внутрь** `timingSafeEqual`, которое никогда не вызывается на уровне модуля.

**Почему это указывает на прерывание:** агент правил сравнение в `timingSafeEqual` и остановился до добавления закрывающей скобки — признак обрыва правки «на полуслове». Поскольку файл остаётся синтаксически корректным, дефект невидим для `tsc --noEmit` (его `include` — только `src`) и линтера.

**Ограничение доказательств:** внутренняя история выполнения Cline недоступна; точную причину прерывания (исчерпание контекста / сбой инструмента) подтвердить нельзя — фиксируем только оставленное состояние файла.

---

## 2. Инвентаризация файлов Task 20A

**Присутствуют и целостны (общие модули Steam — входят в `tsc`, покрыты тестами):**
- `src/lib/steam/steamId.ts` — SteamID64 строкой + `BigInt`, диапазон, извлечение из `claimed_id`.
- `src/lib/steam/openid.ts` — построение `checkid_setup`, валидация ответа, `check_authentication`.
- `src/lib/steam/redirect.ts` — `state` (32 байта), безопасные внутренние пути.
- `src/lib/steam/profile.ts` — allowlist аватаров, очистка ника, разбор `GetPlayerSummaries`.
- `src/lib/steam/stores.ts` — `NonceStore` / `ExchangeStore`, PKCE, хэширование.
- `src/lib/steam/accounts.ts` — привязка/создание, `acceptRecoveredUser`, служебный email.
- `src/lib/steam/handler.ts` — `handleSteamCallback` / `redeemSteamExchange` (чистая логика).

**Присутствуют и целостны (клиент/UI):**
- `src/lib/steamClient.ts` — PKCE-секрет, URL входа/привязки/обмена, маппинг ошибок.
- `src/contexts/AuthContext.tsx` — `startSteamSignIn`, `completeSteamSignIn`, `startSteamLink`, `refreshSteamIdentity`.
- `src/pages/SteamCallbackPage.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/LoginPage.tsx`.
- `src/components/AppHeader.tsx`, `src/styles/layout.css` — аватар/ник в шапке.
- `src/App.tsx` — маршруты `/auth/steam/callback` (публичный) и `/profile` (защищённый).

**Присутствуют (миграции, НЕ применены):**
- `supabase/migrations/20261018120000_dotaz_profiles_match_reports.sql` — существующая схема.
- `supabase/migrations/20261110120000_dotaz_steam_identities.sql` — `steam_identities`, RLS на чтение своей строки, триггер неизменяемости.
- `supabase/migrations/20261110130000_dotaz_steam_replay_and_exchange.sql` — `steam_openid_nonces`, `steam_login_exchanges`, функции `steam_consume_nonce` / `steam_create_exchange` / `steam_redeem_exchange` (только `service_role`).

**Присутствует конфигурация:** `supabase/config.toml` — `[functions.steam-auth] verify_jwt = false`.

**Тесты:** `src/lib/steam/openid.test.ts`, `steamAuth.test.ts`, `hardening.test.ts`, `profile.test.ts`, `src/pages/steamAuthUi.test.tsx` — присутствуют и проходят.

**Повреждён:** `supabase/functions/steam-auth/index.ts` — нет закрывающей `}` у `timingSafeEqual` (строки 138–146).

**Отсутствует (не ошибка):** `supabase/functions/_shared/` — каталога нет; функция импортирует общие модули относительными путями `../../../src/lib/steam/...`. Иной серверной части в репозитории нет.

---

## 3. Подтверждённые дефекты кода

### Дефект 1 — КРИТИЧЕСКИЙ: `timingSafeEqual` без закрывающей скобки (мёртвая Edge Function)
- **Файл/строки:** `supabase/functions/steam-auth/index.ts:138–146` (пропущена `}` после строки 146).
- **Причина:** незавершённая правка; закрывающая скобка функции не записана.
- **Влияние:** тело функции поглощает остальной модуль; `Deno.serve` (строка 626) не исполняется на уровне модуля → задеплоенная функция **не регистрирует HTTP-обработчик** и не может отвечать.
- **Доказательство:** AST-проверка: `timingSafeEqual` 4959→23386, `Deno.serve`=22307 внутри; `SYNTAX_DIAGNOSTICS=0`.
- **Минимальное исправление:** добавить `}` после строки 146 (перед `// --- Подписанный state ...`).
- **Регрессионный тест:** статическая проверка (в стиле `hardening.test.ts`) — читать `index.ts` и утверждать, что `Deno.serve` на верхнем уровне модуля.

### Дефект 2 — ВЫСОКИЙ: eager `createClient` падает на старте при отсутствии секретов
- **Файл/строки:** `supabase/functions/steam-auth/index.ts:53–55`.
- **Причина:** `getAdmin()`-рефакторинг (ленивая инициализация) не выполнен.
- **Влияние:** SDK бросает исключение при пустых значениях: `createClient('', '')` → `"supabaseUrl is required."`; `createClient(url, '')` → `"supabaseKey is required."`. При отсутствии `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` модуль упадёт на старте **до** контролируемого 503 из `missingConfig()` (строки 431–438).
- **Доказательство:** прямой вызов SDK (см. §6); `missingConfig()` вызывается только внутри обработчиков.
- **Минимальное исправление:** ввести `getAdmin()`, создающий клиент лениво **после** `missingConfig()`; заменить `admin` на `getAdmin()` в `gateway`, `handleLinkStart`, `handleCallback`.
- **Регрессионный тест:** обработчики с пустыми env → 503 `not_configured` без исключения на инициализации модуля.

### Замечание (не дефект): защита nonce в PostgreSQL
`nonceStore`/`exchangeStore` используют SQL-функции миграции `20261110130000`; строгая защита от replay между инстансами появится только после её применения (см. §5).

---

## 4. Статус Supabase Edge Function

**Staging:**
- Проект: `wbhbofqldmxqczxmhruk`.
- Функция: `https://wbhbofqldmxqczxmhruk.supabase.co/functions/v1/steam-auth`.

**Диагностические запросы (read-only, без перехода по редиректам Steam):**

| Запрос | Результат |
|---|---|
| `GET /steam-auth/nonexistent` | таймаут, curl exit `28`, HTTP не получен (`HTTP:000`) |
| `GET /steam-auth/login` | таймаут, curl exit `28`, HTTP не получен |
| `POST /steam-auth/exchange` (некорректный body, без Origin) | таймаут, curl exit `28`, HTTP не получен |

Все три запроса завершились `Operation timed out after 8000 milliseconds with 0 bytes received` — то есть **сетевая недостижимость / долгое отсутствие ответа**, а не ошибка исполнения curl и не HTTP-статус приложения. Из текущего окружения невозможно отличить «не задеплоена», «не запускается», «шлюз блокирует» или «нет исходящего доступа».

**Где владелец должен смотреть (Supabase Dashboard):**
- Edge Functions → `steam-auth` — список деплоев и статус.
- Logs → Edge Functions → `steam-auth` — runtime-ошибки (ожидаемая при текущем дефекте — «no `Deno.serve` handler» либо 500 на каждый запрос).
- Проверить, что секреты `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STEAM_STATE_SECRET`, `APP_ORIGIN` заданы.

**Вывод:** статус деплоя **NOT TESTED / BLOCKED** — подтвердить невозможно из этого окружения.

---

## 5. Безопасность Steam Auth

**Пройдено (по коду и модульным тестам):**
- SteamID64 только строкой и `BigInt` (17 цифр, диапазон); `number`/`bigint` отвергаются.
- OpenID 2.0: режим `id_res`, строгий `op_endpoint`, сверка `claimed_id`/`identity`, `realm`/`return_to`, свежесть `response_nonce`, обязательный `check_authentication` с `is_valid:true`.
- CSRF: `state` 32 случайных байта, HMAC-подпись (`timingSafeEqual` в нормальном виде), HttpOnly cookie.
- PKCE: секрет в `sessionStorage` приложения, на сервере только SHA-256 (challenge), атомарное списание кода.
- Привязка: только по `Bearer` + `admin.auth.getUser`; UUID существующего пользователя не меняется.
- RLS в миграциях: `steam_identities` только на чтение своей строки, без политик записи; триггер неизменяемости владельца/SteamID.
- Origin/CORS: только `APP_ORIGIN`; внешние пути и `/login` в redirect отбрасываются.
- Секреты — только `supabase secrets`, ничего в `VITE_*`.

**Оставшиеся риски:**
- **КРИТИЧЕСКИЙ:** дефект `timingSafeEqual` (§3) делает функцию нерабочей — вся цепочка входа мёртвая.
- **ВЫСОКИЙ:** eager `createClient` → crash на старте при отсутствии секретов (§3).
- **ВЫСОКИЙ (не проверено):** реальный OpenID-обмен с настоящим Steam, реальная сессия Supabase для ожидаемого UUID, повторный вход без дубликатов, RLS на живой БД.
- **СРЕДНИЙ:** защита nonce между инстансами строга только после применения миграции `20261110130000`.

**Непроверенные потоки:** весь браузерный E2E (new user / legacy link / no-link / two accounts / cancel / error / mobile RU/EN / reload / expiry / logout).

---

## 6. Автоматизированные проверки (выполнены один раз)

| Проверка | Результат |
|---|---|
| `npx.cmd tsc --noEmit` | **PASSED** — exit 0, без диагностик (проверяет `src`, но **не** `supabase/functions`) |
| `npx.cmd vitest run` | **PASSED** — **63 файла / 1080 тестов**, exit 0 (в выводе только benign-предупреждения react-router `useLayoutEffect` при SSR) |
| `npm.cmd run build` | **PASSED** — exit 0, создан `dist/`; предупреждение «chunk 857 kB > 500 kB» (ранее существовавшее) |
| `git diff --check` | **PASSED** — exit 0, ошибок пробелов/пустых строк нет |
| esbuild-разбор `index.ts` | **NOT TESTED** — esbuild не установлен (npx предложил установку); вместо этого использован компилятор TypeScript (см. §1) |
| curl к staging | **BLOCKED** — трижды timeout exit `28`, HTTP не получен |

**Дополнительно подтверждено обращением к SDK:** `createClient('', '')` → `"supabaseUrl is required."`; `createClient('https://x.supabase.co', '')` → `"supabaseKey is required."` — основание для Дефекта 2.

Замечание: `tsc` охватывает только `src` (`tsconfig.json` `include: ["src"]`), поэтому синтаксически «валидный», но структурно сломанный `supabase/functions/steam-auth/index.ts` в сборку/тесты не попадает — именно поэтому дефект §1 невидим для локальных проверок.

---

## 7. Синхронизация с GitHub

- Ветка: `master`; локальный `HEAD` и `origin/master` совпадают (`4066a67 task 19.2`), ahead/behind = 0 после `git fetch --prune`.
- `.gitignore` корректно исключает секреты: `.env`, `.env.*` (кроме `.env.example`), `*.pem`/`*.key`, `*.log`, `supabase/.temp/`, `/public/benchmarks/*.json`. Утечки учётных данных не обнаружено.

**Изменённые (tracked, не закоммичены):** `.env.example`, `.gitignore`, `ARCHITECTURE.md`, `PLAN.md`, `Product_brief.md`, `README.md`, `src/App.tsx`, `src/components/AppHeader.tsx`, `src/components/protectedRoute.test.tsx`, `src/contexts/AuthContext.tsx`, `src/i18n/translations.ts`, `src/i18n/translationsEn.ts`, `src/pages/LoginPage.tsx`, `src/pages/historyPage.test.tsx`, `src/pages/matchPage.test.tsx`, `src/styles/layout.css`, `tsconfig.json`.

**Новые (untracked) файлы Task 20A, подлежащие будущему коммиту:**
- `src/lib/steam/` (8 модулей + тесты), `src/lib/steamClient.ts`
- `src/pages/ProfilePage.tsx`, `src/pages/SteamCallbackPage.tsx`, `src/pages/steamAuthUi.test.tsx`
- `supabase/config.toml`, `supabase/functions/steam-auth/index.ts`
- `supabase/migrations/20261110120000_dotaz_steam_identities.sql`, `supabase/migrations/20261110130000_dotaz_steam_replay_and_exchange.sql`

**Не коммитить:** `.env`, `.env.staging.local`, `.env.staging.secrets`, `supabase/.temp/`, `public/benchmarks/*.json`, любые `_*.log`/`_*.txt` служебные файлы аудита.

Во время аудита **ничего не стейджилось/не коммитилось/не пушилось**; production не изменялся.

---

## 8. Необходимые исправления (по приоритету)

1. **[P0] Восстановить `}` у `timingSafeEqual`** (`supabase/functions/steam-auth/index.ts:147`). Одна строка. Иначе функция мёртвая независимо от остального.
2. **[P1] Ввести ленивый `getAdmin()`** вместо `const admin = createClient(...)` на строке 53; создавать клиент только после прохождения `missingConfig()`. Заменить все обращения `admin.` на `getAdmin().`.
3. **[P1] Добавить регрессионные тесты**: статическая проверка, что `Deno.serve` на верхнем уровне модуля; обработчики с пустыми env → 503 `not_configured` без исключения.
4. **[P2] Повторно прогнать** `tsc --noEmit`, `vitest run`, `npm run build`, `git diff --check` после правок.
5. **[P2] Деплой-диагностика staging** владельцем (Dashboard/логи) — после применения P0 и постановки секретов.
6. **[P3] Полная staging-приёмка** по чек-листу A–D и критериям go/no-go из `README.md` (11 пунктов): миграции, реальный Steam `is_valid:true`, PKCE, сессия для ожидаемого UUID, отсутствие дубликатов, привязка legacy без потери истории, RLS, отклонение подделки/отмены/просрочки/replay/чужого PKCE/Origin.

Никаких действий по БД и деплою в рамках настоящего аудита не выполнялось и не выполняется.

---

## 9. Статус по PLAN.md (критерии приёмки Task 20A)

Критерии из `PLAN.md` (раздел Task 20A «Критерии приёмки») сопоставлены с фактическим состоянием:

| Критерий | Статус |
|---|---|
| Реальный Steam-вход, подтверждённая личность, корректный SteamID64 и Supabase-сессия | **NOT TESTED** (код есть, живой вход не выполнялся) |
| Нет подмены SteamID или чужого UUID | **PASSED** на уровне unit-логики; **NOT TESTED** на живой системе |
| Существующий пользователь при привязке получает тот же `auth.uid()` и все отчёты | реализовано в `linkSteamToExistingUser`; **NOT TESTED** на живых данных |
| Пользователь без привязки не теряет возможность восстановления | реализовано (`acceptRecoveredUser`, fail-closed); **NOT TESTED** |
| Разные аккаунты не читают/меняют отчёты друг друга (RLS) | миграции написаны; **NOT TESTED** (не применены) |
| Нет утечек секретов в клиент, логи, Git | **PASSED** (`.gitignore`, `VITE_*` без секретов, `.env*` игнорируются) |
| Успешны авто и ручные E2E (браузер, мобильные, RU/EN, reload, expiry, logout) | **NOT TESTED** |
| Деплой/commit/push только после отдельного разрешения владельца | соблюдается — ничего не коммитилось/не деплоилось |

**Итоговый статус Task 20A: `in_progress`, BLOCKED** — ни один удалённый критерий не может быть подтверждён из-за (а) структурной поломки Edge Function и (б) недостижимости staging из окружения аудита.

---

## 10. Следующий шаг

**Один конкретный шаг:** устранить Дефект 1 — добавить недостающую закрывающую `}` в `supabase/functions/steam-auth/index.ts` после строки 146 (и, сразу в том же изменении, заменить eager `const admin` на ленивую `getAdmin()` согласно Дефекту 2), затем прогнать `npx.cmd tsc --noEmit`, `npx.cmd vitest run`, `npm.cmd run build`, `git diff --check` и представить исправление владельцу для отдельного разрешения на деплой/staging-приёмку.

AUDIT COMPLETE — TASK 20A