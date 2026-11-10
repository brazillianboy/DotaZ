import { en } from './translationsEn'

/**
 * Словари локализации RU/EN (Task 13).
 *
 * Русский словарь — базовый: `TranslationKey` выводится из его ключей, поэтому
 * английский словарь обязан содержать те же ключи (проверяется тестами).
 *
 * В интерполяции используются плейсхолдеры вида `{value}`; технические
 * идентификаторы (имена полей OpenDota, rule_id, match_id) не переводятся.
 */

export type Locale = 'ru' | 'en'

export const LOCALES: readonly Locale[] = ['ru', 'en']

export const DEFAULT_LOCALE: Locale = 'ru'

export const ru = {
  // --- Общие ---
  'common.noData': 'Нет данных',
  'common.loading': 'Загрузка…',
  'common.retry': 'Повторить',
  'common.backHome': '← Вернуться на главную',
  'common.goHome': 'Перейти на главную',
  'common.check': 'Проверка…',
  'common.sourceLabel': 'Источник: {source}',
  'common.periodLabel': 'Период: {period}',
  'common.skippedRecords':
    'Часть записей не показана: непригодные метаданные ({count}). Данные не изменялись и не удалялись.',

  // --- Навигация и шапка ---
  'nav.home': 'Главная',
  'nav.heroes': 'Персонажи',
  'nav.meta': 'Мета',
  'nav.history': 'История',
  'nav.about': 'О проекте',
  'nav.sectionSoon': 'Раздел появится позже',
  'nav.mainLabel': 'Основная навигация',
  'nav.brandHome': 'DotaZ — на главную',
  'nav.openMenu': 'Открыть меню',
  'nav.closeMenu': 'Закрыть меню',
  'nav.skipToContent': 'Перейти к содержимому',
  'nav.login': 'Войти',
  'nav.register': 'Зарегистрироваться',
  'nav.logout': 'Выйти',
  'nav.loggingOut': 'Выходим…',
  'nav.logoutFailed': 'Не удалось выйти. Повторите попытку.',

  // --- Переключатель языка ---
  'language.label': 'Язык интерфейса',
  'language.ru': 'Русский',
  'language.en': 'English',
  'language.switchTo': 'Переключить на {language}',

  // --- Подвал ---
  'footer.note':
    'Учебный концепт анализа матчей Dota 2: загрузка матчей из OpenDota, статистика, наблюдения и личная история отчётов.',

  // --- Главная страница ---
  'home.titlePrefix': 'Анализируй свои игры в Dota 2 и становись лучше с',
  'home.lead':
    'Разбирай матчи, получай достоверную статистику и обоснованные наблюдения, следи за метой. Всё, что нужно для роста — в одной платформе.',
  'home.formLabel': 'Форма получения матча',
  'home.inputPlaceholder': 'Введите ID матча (например, 9007760151)',
  'home.inputLabel': 'ID матча',
  'home.submit': 'Анализировать',
  'home.howToFindTitle': 'Где найти ID матча?',
  'home.howToFindExample': 'Пример:',
  'home.howToFindText':
    'По ID матча запрашиваются данные у OpenDota: статистика всех участников, отчёт о стадии линии 00:00–10:00 и наблюдения по подтверждённым фактам.',
  'home.featuresTitle': 'Планируемые возможности платформы',
  'home.feature.analytics.title': 'Подробная аналитика',
  'home.feature.analytics.text': 'Статистика, наблюдения и рекомендации.',
  'home.feature.meta.title': 'Информация о мете',
  'home.feature.meta.text': 'Актуальные герои и стратегии.',
  'home.feature.lane.title': 'Анализ линии',
  'home.feature.lane.text': 'Разбор первых 10 минут матча.',
  'home.feature.averages.title': 'Средние показатели',
  'home.feature.averages.text': 'Сравнение с другими игроками.',
  'home.feature.history.title': 'Личная история',
  'home.feature.history.text': 'Все проанализированные матчи.',
  'home.feature.languages.title': 'Русский и английский',
  'home.feature.languages.text': 'Выбери удобный язык.',
  'home.stepsTitle': 'Как это работает?',
  'home.step1.title': 'Введи ID матча',
  'home.step1.text': 'Скопируй ID из Dota 2 и вставь на сайт.',
  'home.step2.title': 'Мы анализируем',
  'home.step2.text': 'Получаем данные с OpenDota и анализируем матч.',
  'home.step3.title': 'Получай результаты',
  'home.step3.text': 'Смотри статистику, наблюдения и рекомендации.',
  'home.step4.title': 'Становись лучше',
  'home.step4.text': 'Используй рекомендации и улучшай свою игру.',
  'home.guideLabel': 'Разделы платформы',
  'home.guide.heroes.title': 'Персонажи',
  'home.guide.heroes.text': 'Винрейты, пики, предметы и средние показатели.',
  'home.guide.meta.title': 'Актуальная мета',
  'home.guide.meta.text': 'Следи за трендами и сильными героями текущего патча.',
  'home.guide.meta.note': 'Раздел в разработке — пока без ссылки.',
  'home.guide.example.title': 'Пример анализа',
  'home.guide.example.text': 'Посмотри, как выглядит подробный отчёт по матчу.',
  'home.guide.history.title': 'История матчей',
  'home.guide.history.text': 'Все твои анализы в одном месте.',
  'home.soon': 'Скоро',
  'home.preview.aria': 'Пример карточки матча — дизайн-превью с демонстрационными данными',
  'home.preview.badge': 'Дизайн-превью',
  'home.preview.link': 'Посмотреть пример анализа →',
  'home.preview.note': 'Демонстрационные данные, не из OpenDota.',

  // --- Ошибки OpenDota и валидации ---
  'errors.matchId.empty': 'Введите ID матча.',
  'errors.matchId.digits': 'ID матча должен содержать только цифры (положительное целое число).',
  'errors.matchId.positive': 'ID матча должен быть положительным числом.',
  'errors.matchId.tooLong': 'ID матча слишком длинный — проверьте ввод.',
  'errors.opendota.not_found': 'Матч не найден. Проверьте ID и попробуйте снова.',
  'errors.opendota.forbidden':
    'OpenDota отклонил запрос (доступ ограничен, HTTP {status}). Это ограничение доступа к провайдеру, а не отсутствие матча.',
  'errors.opendota.rate_limited': 'Превышен лимит запросов OpenDota. Попробуйте позже.',
  'errors.opendota.server_error': 'Сервис OpenDota временно недоступен (ошибка сервера). Попробуйте позже.',
  'errors.opendota.unexpected_status':
    'OpenDota вернул неожиданный ответ (HTTP {status}). Повторите попытку позже.',
  'errors.opendota.network':
    'Сеть недоступна или OpenDota не отвечает. Проверьте подключение и повторите попытку.',
  'errors.opendota.timeout': 'Истекло время ожидания ответа OpenDota (15 секунд). Повторите попытку.',
  'errors.opendota.invalid_response':
    'Не удалось обработать ответ OpenDota: получены некорректные данные.',
  'errors.opendota.aborted': 'Запрос отменён.',
  'errors.opendota.unexpected': 'Не удалось получить матч. Повторите попытку позже.',
  'errors.opendota.httpStatus': 'HTTP-статус ответа: {status}',
  'errors.opendota.checkId': 'Проверьте ID матча: возможно, он указан неверно.',

  // --- Аутентификация ---
  'auth.loginTitle': 'Вход в аккаунт',
  'auth.registerTitle': 'Регистрация',
  'auth.checkingSession': 'Проверяем сессию…',
  'auth.emailLabel': 'Email',
  'auth.passwordLabel': 'Пароль',
  'auth.passwordConfirmLabel': 'Повторите пароль',
  'auth.emailPlaceholder': 'you@example.com',
  'auth.passwordPlaceholder': '••••••••',
  'auth.submitLogin': 'Войти',
  'auth.submittingLogin': 'Входим…',
  'auth.submitRegister': 'Зарегистрироваться',
  'auth.submittingRegister': 'Создаём аккаунт…',
  'auth.noAccountHint': 'Нет аккаунта?',
  'auth.registerLink': 'Зарегистрируйтесь',
  'auth.haveAccountHint': 'Уже есть аккаунт?',
  'auth.loginLink': 'Войдите',
  'auth.alreadyLoggedIn': 'Вы уже вошли в аккаунт ({email}).',
  'auth.alreadyLoggedInNoRegister': 'Вы уже вошли в аккаунт ({email}) — регистрация не требуется.',
  'auth.notConfiguredLogin':
    'Авторизация недоступна: Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальный .env (см. .env.example) и перезапустите dev-сервер.',
  'auth.notConfiguredRegister':
    'Регистрация недоступна: Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальный .env (см. .env.example) и перезапустите dev-сервер.',
  'auth.checkEmailTitle': 'Проверьте электронную почту',
  'auth.checkEmailText':
    'Если регистрация доступна для этого адреса, вы получите письмо с дальнейшими инструкциями. Если у вас уже есть аккаунт, попробуйте войти.',
  'auth.goToLogin': 'Перейти ко входу',
  'auth.signedIn': 'Аккаунт создан — вы вошли в систему.',
  'auth.error.emailRequired': 'Укажите email.',
  'auth.error.passwordRequired': 'Укажите пароль.',
  'auth.error.passwordMismatch': 'Пароли не совпадают.',
  'auth.error.notConfigured':
    'Авторизация временно недоступна: Supabase не настроен. Обратитесь к администратору проекта.',
  'auth.error.generic': 'Не удалось выполнить операцию. Повторите попытку позже.',
  'auth.error.network':
    'Сеть недоступна или сервис не отвечает. Проверьте подключение к интернету и повторите попытку.',
  'auth.error.invalidCredentials': 'Неверный email или пароль.',
  'auth.error.emailNotConfirmed':
    'Email ещё не подтверждён. Проверьте почту и перейдите по ссылке из письма.',
  'auth.error.alreadyRegistered': 'Похоже, аккаунт с таким email уже существует. Попробуйте войти.',
  'auth.error.rateLimited': 'Слишком много попыток. Подождите немного и повторите.',
  'auth.error.weakPassword':
    'Пароль не соответствует требованиям проекта Supabase. Выберите пароль длиннее.',
  'auth.error.invalidEmail': 'Указан некорректный email.',
  'auth.error.signupDisabled': 'Регистрация временно отключена в настройках проекта.',
  'auth.error.linkInvalid': 'Ссылка недействительна или устарела. Запросите новое письмо.',
  'auth.confirm.title': 'Подтверждение email',
  'auth.confirm.pending': 'Выполняем подтверждение аккаунта…',
  'auth.confirm.notConfigured':
    'Подтверждение недоступно: Supabase не настроен. Проверьте переменные окружения приложения.',
  'auth.confirm.invalidLink':
    'Ссылка подтверждения недействительна или устарела. Запросите новое письмо.',
  'auth.confirm.hashFailed': 'Не удалось обработать данные подтверждения. Запросите новое письмо.',
  'auth.confirm.missingData': 'Ссылка подтверждения не содержит данных. Запросите новое письмо.',
  'auth.confirm.success': 'Email подтверждён — аккаунт активирован. Теперь вы можете войти.',
  'auth.guard.badge': 'Проверка доступа',
  'auth.guard.title': 'Проверка авторизации…',
  'auth.guard.text':
    'Проверяем вашу сессию. Если вход выполнен, приватный раздел откроется автоматически.',

  // --- Страница матча ---
  'match.badge': 'Данные OpenDota',
  'match.title': 'Матч {id}',
  'match.idInResponse': 'ID матча в ответе',
  'match.duration': 'Длительность',
  'match.durationSeconds': '({seconds} с)',
  'match.winner': 'Победитель',
  'match.playersInResponse': 'Участников в ответе',
  'match.source': 'Источник данных',
  'match.loadingBadge': 'Загрузка',
  'match.analysisTitle': 'Анализ выбранного игрока',
  'match.phase.checkingReport': 'Проверяем сохранённый отчёт…',
  'match.phase.fetching': 'Запрашиваем данные матча у OpenDota…',
  'match.phase.analyzing': 'Формируем наблюдения по всем участникам…',
  'match.phase.saving': 'Сохраняем отчёт в личную историю…',
  'match.phase.session': 'Проверяем состояние сессии…',
  'match.phase.requestingParse': 'Запрашиваем обработку реплея…',
  'match.phase.waitingParse': 'OpenDota обрабатывает реплей…',
  'match.phase.refetching': 'Подготавливаем анализ первых 15 минут…',
  'match.invalid.badge': 'Некорректный ID',
  'match.invalid.title': 'Проверьте ID матча',
  'match.invalid.note':
    'Запрос к OpenDota не отправлялся: ID матча должен быть положительным целым числом.',
  'match.error.badge': 'Ошибка запроса',
  'match.error.title': 'Не удалось получить матч {id}',
  'match.error.sourceLine': 'Источник данных: OpenDota (запрос завершился ошибкой)',
  'match.error.retry': 'Повторить запрос',
  'match.reportError.badge': 'Сохранённый отчёт недоступен',
  'match.reportError.title': 'Не удалось показать сохранённый отчёт по матчу {id}',
  'match.reportError.note':
    'Запись в базе данных не изменялась: повреждённый или неизвестный формат отчёта не перезаписывается автоматически, новый отчёт для этого матча не создавался.',
  'match.players.title': 'Участники',
  'match.players.empty': 'Данные об участниках отсутствуют.',
  'match.players.unknownTeam': 'Команда не определена',
  'match.players.selected': 'Выбран',
  'match.players.playerLabel': 'Игрок — слот {slot}',
  'match.players.heroSuffix': ' · герой {heroId}',
  'match.stats.title': 'Статистика игрока',
  'match.stats.empty': 'Выберите участника, чтобы увидеть его статистику.',
  'match.stats.slot': 'Слот',
  'match.stats.team': 'Сторона',
  'match.stats.heroId': 'Герой (hero_id)',
  'match.stats.kda': 'K / D / A',
  'match.stats.gpm': 'ЗПМ',
  'match.stats.xpm': 'ОПМ',
  'match.stats.lastHits': 'Ластхиты',
  'match.stats.gpmHint': 'Золото в минуту',
  'match.stats.xpmHint': 'Опыт в минуту',
  'match.stats.hint':
    'Значения приведены как есть из ответа OpenDota. «Нет данных» означает отсутствие поля в ответе и не заменяется нулём. Last hits — показатель за матч, а не за первые 10 минут. Разбор линии и наблюдения показаны ниже.',

  // --- Ранняя стадия 00:00–15:00 ---
  'laning.title': 'Стадия линии — {interval}',
  'laning.empty': 'Выберите участника, чтобы увидеть данные стадии линии.',
  'laning.unavailable':
    'Детальные данные ранней стадии для этого матча недоступны: OpenDota не вернула поминутные ряды и журналы событий (реплей не обработан). Отсутствующие значения не подменяются нулями.',
  'laning.lastHits': 'Добивания к {minute}',
  'laning.gold': 'Золото к {minute}',
  'laning.xp': 'Опыт к {minute}',
  'laning.kills': 'Убийства {interval}',
  'laning.deaths': 'Смерти {interval}',
  'laning.efficiency': 'Эффективность линии (OpenDota)',
  'laning.purchasesTitle': 'Покупки {interval}:',
  'laning.purchasesMissing': 'Журнал покупок недоступен в ответе OpenDota.',
  'laning.purchasesEmpty':
    'В интервале {interval} нет отображаемых предметов (журнал получен; обычные расходники скрыты).',
  'laning.purchasesHidden': 'Скрыто обычных расходников: {count}.',
  'laning.purchasesNote':
    'Показаны компоненты и собранные предметы интервала; обычные расходники (Tango, Clarity, Healing Salve, Enchanted Mango, Faerie Fire, варды, Smoke of Deceit, Dust of Appearance, Town Portal Scroll) скрыты. Исключения показываются всегда: Bottle, Aghanim’s Shard, Refresher Shard, Cheese, Block of Cheese.',
  'laning.hint':
    'Источник: OpenDota. Период: {interval}. Поминутные показатели берутся из массивов OpenDota (индекс 15 соответствует 15:00) и не подменяются статистикой за весь матч; события фильтруются по времени в секундах, покупки — ещё и по типу предмета (обычные расходники скрыты). «Нет данных» означает отсутствие поля в ответе. Оценки качества линии не выполняются: подтверждённые нормы героя и роли появятся в следующих задачах.',

  // --- Предметы за матч ---
  'items.title': 'Предметы за матч',
  'items.lead':
    'Значимые приобретения за весь матч: время — момент первой покупки по журналу OpenDota. Показаны собранные предметы, Bottle и базовые Boots of Speed без подтверждённого улучшения; компоненты, обычные расходники и рецепты скрыты — подробный список покупок интервала есть в отчёте о стадии линии.',
  'items.selectPlayer': 'Выберите участника, чтобы увидеть предметы.',
  'items.empty':
    'Значимых приобретений не зафиксировано: в журнале нет собранных предметов, Bottle и базовых Boots of Speed.',
  'items.noLog':
    'Журнал покупок за матч недоступен в ответе OpenDota — секция не может быть построена.',
  'items.legacyUnavailable':
    'Сохранённый отчёт старого формата не содержит журнал покупок за весь матч — секция недоступна без нового запроса к OpenDota.',
  'items.hint':
    'Секция за весь матч показывает только значимые приобретения: собранные предметы, Bottle и базовые Boots of Speed, если они не были улучшены в собранные сапоги (Power Treads, Phase Boots, Arcane Boots, Tranquil Boots, Boots of Travel, Boots of Travel 2, Guardian Greaves, Boots of Bearing). Компоненты (Iron Branch, Gloves of Haste, Mithril Hammer, Magic Stick и др.), обычные расходники, рецепты, Refresher Shard, Cheese и Block of Cheese здесь скрыты; подробный список покупок интервала 00:00–15:00 — в отчёте о стадии линии. Улучшение сапог определяется по подтверждённой истории покупок, а не по финальному инвентарю. Время — момент первой покупки предмета по журналу OpenDota; если время не подтверждено, предмет не показывается.',

  // --- Наблюдения и рекомендации ---
  'analysis.observationsTitle': 'Наблюдения',
  'analysis.notAnAssessment': 'Наблюдение, не оценка',
  'analysis.selectPlayer': 'Выберите участника, чтобы увидеть наблюдения по данным матча.',
  'analysis.rulesVersion': 'Версия правил анализа: {version}',
  'analysis.insufficientData': 'Недостаточно данных для достоверной оценки.',
  'analysis.recommendationsTitle': 'Рекомендации',
  'analysis.recommendationsUnavailable':
    'Объективные рекомендации недоступны: в документации проекта не подтверждены нормы героя и роли, поэтому сравнение показателей с эталоном и советы по игре не формируются. Наблюдения выше описывают только факты из ответа OpenDota.',
  'analysis.ruleLabel': 'Правило: {ruleId}',
  'analysis.limitationsTitle': 'Ограничения анализа',
  'analysis.noLimitations': 'Ограничений не зафиксировано.',
  'analysis.translationUnavailable':
    'Перевод недоступен: сохранённый текст показан как есть (правило {ruleId} версии {ruleVersion}).',

  // --- Сохранение личного отчёта ---
  'persistence.title': 'Личный отчёт',
  'persistence.stored.badge': 'Сохранённый отчёт',
  'persistence.stored.summary':
    'Показан ранее сохранённый личный отчёт: OpenDota не запрашивалась, наблюдения не пересчитывались.',
  'persistence.saved.badge': 'Новый отчёт сохранён',
  'persistence.saved.summary': 'Отчёт сформирован и сохранён в личной истории.',
  'persistence.saved.summaryPartial':
    'Отчёт сформирован и сохранён в личной истории (частичные данные — см. ограничения ниже).',
  'persistence.conflict.badge': 'Сохранённый отчёт',
  'persistence.conflict.summary':
    'Отчёт уже был сохранён другим запросом: показана существующая запись, вторая строка не создавалась и данные не перезаписаны.',
  'persistence.guest.badge': 'Гостевой режим',
  'persistence.guest.summary':
    'Отчёт не сохраняется: вы не вошли в аккаунт. Анализ рассчитан из данных OpenDota и показан только на этой странице.',
  'persistence.guest.loginHint': 'Чтобы отчёт сохранялся в личную историю, войдите в аккаунт.',
  'persistence.guest.loginLink': 'Войти в аккаунт',
  'persistence.noDatabase.badge': 'Сохранение недоступно',
  'persistence.noDatabase.summary':
    'Анализ рассчитан, но личная история недоступна: подключение к базе данных не настроено.',
  'persistence.failed.badge': 'Отчёт не сохранён',
  'persistence.failed.summary': 'Отчёт сформирован, но сохранить его не удалось.',
  'persistence.unresolved.badge': 'Незавершённая запись',
  'persistence.unresolved.summary':
    'Показан заново рассчитанный отчёт: существующая запись не перезаписывалась.',
  'persistence.partialNote':
    'Частичный отчёт: часть данных провайдера недоступна — сохранены только подтверждённые значения (отсутствующие показатели остаются пустыми).',
  'persistence.rulesVersionLabel': 'Версия правил анализа:',
  'persistence.sourceLabel': 'Источник данных:',
  'persistence.fetchedAt': 'Данные OpenDota получены: {value}',
  'persistence.savedAt': 'Отчёт сохранён: {value}',
  'persistence.reportId': 'Идентификатор отчёта: {id}',
  'persistence.limitationsTitle': 'Ограничения сохранённых данных',
  'persistence.retry': 'Повторить сохранение',
  'persistence.retrying': 'Сохраняем…',
  'persistence.refreshed.badge': 'Отчёт обновлён',
  'persistence.refreshed.summary':
    'Сохранённый отчёт обновлён подтверждёнными подробными данными реплея: изменена только ваша строка, дубликаты не создавались.',
  'persistence.refreshSkipped.badge': 'Сохранённый отчёт без изменений',
  'persistence.refreshSkipped.notUsable':
    'Запись отчёта не готова к обновлению: сохранённые данные не изменялись.',
  'persistence.refreshSkipped.storedDetailed':
    'Сохранённый отчёт уже содержит подробные данные: перезапись не выполнялась.',
  'persistence.refreshSkipped.notDetailed':
    'Подробные данные реплея получить не удалось: показан ранее сохранённый отчёт.',
  'persistence.refreshSkipped.worseData':
    'Новые данные неполнее сохранённых: отчёт оставлен без изменений.',
  'persistence.refreshFailed.summary':
    'Подробные данные получены, но обновить сохранённый отчёт не удалось — показан прежний отчёт.',

  // --- Обработка реплея (Task 14) ---
  'parse.title': 'Обработка реплея OpenDota',
  'parse.badge.ready': 'Анализ готов',
  'parse.badge.pending': 'Обработка продолжается',
  'parse.badge.unavailable': 'Реплей недоступен',
  'parse.badge.failed': 'Обработка не завершена',
  'parse.ready': 'Анализ готов: подробные данные реплея загружены.',
  'parse.pending':
    'OpenDota продолжает обработку реплея. Запрос сохранён: при следующем открытии страницы наблюдение продолжится автоматически.',
  'parse.replayUnavailable': 'Реплей недоступен. Показана доступная статистика.',
  'parse.rateLimited': 'OpenDota ограничил частоту запросов. Показана доступная статистика.',
  'parse.networkFailed':
    'Сеть недоступна или OpenDota не отвечает. Показана доступная статистика.',
  'parse.failed':
    'Не удалось получить подробные данные реплея. Показана доступная статистика.',
  'parse.incomplete':
    'Реплей обработан, но подробные данные всё ещё неполные. Показана доступная статистика.',
  'parse.hint':
    'Запрос обработки отправляется автоматически — отдельная кнопка не нужна. Повторные запросы ограничены, чтобы не расходовать лимиты OpenDota.',

  // --- Шапка матча (Task 15) ---
  'matchHeader.winnerRadiant': 'Победа Света',
  'matchHeader.winnerDire': 'Победа Тьмы',
  'matchHeader.winnerUnknown': 'Победитель не подтверждён',
  'matchHeader.score': 'Счёт',
  'matchHeader.scoreUnavailable': 'Счёт недоступен: данных участников недостаточно.',
  'matchHeader.scoreProvider': 'Счёт из подтверждённых полей OpenDota.',
  'matchHeader.scorePlayers': 'Счёт рассчитан по подтверждённым убийствам всех десяти участников.',
  'matchHeader.duration': 'Длительность',
  'matchHeader.matchId': 'ID матча',
  'matchHeader.gameMode': 'Режим игры',
  'matchHeader.region': 'Регион',
  'matchHeader.started': 'Начало матча',
  'matchHeader.ageDays': '{days} дн. назад',
  'matchHeader.source': 'Источник',
  'matchHeader.sourceValue': 'OpenDota',
  'matchHeader.radiantShort': 'Свет',
  'matchHeader.direShort': 'Тьма',

  // --- Обзор команд (Task 15) ---
  'team.radiantTitle': 'Свет',
  'team.direTitle': 'Тьма',
  'team.tableLabel': 'Обзор команды {team}',
  'team.columnHero': 'Герой',
  'team.columnPlayer': 'Игрок',
  'team.columnLevel': 'Ур.',
  'team.columnKda': 'У / С / П',
  'team.columnLastHits': 'Ластхиты',
  'team.columnDenies': 'Добивания',
  'team.columnNetWorth': 'Общая ценность',
  'team.columnGpm': 'ЗПМ',
  'team.columnXpm': 'ОПМ',
  'team.columnGpmHint': 'Золото в минуту',
  'team.columnXpmHint': 'Опыт в минуту',
  'team.columnHeroDamage': 'Урон героям',
  'team.columnTowerDamage': 'Урон зданиям',
  'team.columnHealing': 'Лечение',
  'team.columnItems': 'Предметы',
  'team.unknownPlayer': 'Неизвестный игрок',
  'team.heroUnknown': 'герой #{id}',
  'team.unknownHeroImage': 'Изображение героя недоступно',
  'team.heroImageAlt': 'Портрет героя: {hero}',
  'team.itemsUnavailable': 'Инвентарь недоступен',
  'team.itemAlt': 'Предмет: {item}',
  'team.noPlayers': 'Нет подтверждённых участников этой команды.',
  'team.selectHint': 'Выберите строку, чтобы открыть подробный анализ участника.',
  'team.selectedMark': 'Выбран',
  'team.hint':
    'Данные — из ответа OpenDota; «{dash}» означает отсутствие поля. ЗПМ и ОПМ — показатели в минуту, а не суммарные золото и опыт.',

  // --- Прокачка способностей (Task 15) ---
  'abilities.title': 'Прокачка способностей',
  'abilities.lead':
    'Порядок изучения способностей и талантов по уровням героя (запись OpenDota).',
  'abilities.teamTitle': 'Прокачка: {team}',
  'abilities.level': 'Уровень {level}',
  'abilities.talent': 'Талант',
  'abilities.ability': 'Способность',
  'abilities.talentMark': 'Т',
  'abilities.unknownAbility': 'Неизвестная способность #{id}',
  'abilities.unknownName': 'Название недоступно',
  'abilities.unavailable': 'Запись прокачки способностей отсутствует в ответе OpenDota.',
  'abilities.catalogUnavailable':
    'Справочник способностей недоступен: показаны только ID без названий и иконок.',
  'abilities.loading': 'Загружаем справочник способностей…',
  'abilities.empty': 'Способности не зафиксированы.',
  'abilities.orderLabel': 'Порядок {order}',
  'abilities.heroImageAlt': 'Портрет героя: {hero}',
  'abilities.abilityImageAlt': 'Иконка способности: {ability}',
  'abilities.selectHint': 'Нажмите на строку игрока, чтобы открыть его анализ.',
  'abilities.hint':
    'Порядок и уровни берутся из записи OpenDota без домысливания: пропущенные уровни не восстанавливаются, таланты помечены отдельно.',

  // --- Карта зданий (Task 15) ---
  'buildings.title': 'Карта зданий',
  'buildings.lead': 'Состояние башен, бараков и трона на конец матча.',
  'buildings.teamTitle': 'Здания: {team}',
  'buildings.standing': 'Стоит',
  'buildings.destroyed': 'Разрушено',
  'buildings.unknown': 'Неизвестно',
  'buildings.towerTier': 'Башня T{tier}',
  'buildings.barracksMelee': 'Бараки (ближний бой)',
  'buildings.barracksRanged': 'Бараки (дальний бой)',
  'buildings.ancient': 'Трон',
  'buildings.laneTop': 'верх',
  'buildings.laneMid': 'центр',
  'buildings.laneBot': 'низ',
  'buildings.destroyedAt': 'разрушено на {time}',
  'buildings.noTime': 'время разрушения не подтверждено',
  'buildings.tower4Note':
    'Две башни T4 приходят под одним ключом события: позиция конкретной башни не определяется, время не приписывается.',
  'buildings.unavailable': 'Данные о состоянии зданий отсутствуют в ответе OpenDota.',
  'buildings.mapLabel': 'Схема карты с состоянием зданий',
  'buildings.summaryTitle': 'Текстовое описание',
  'buildings.legend': 'Состояние: стоит, разрушено, неизвестно.',
  'buildings.schematicNote':
    'Координаты строений взяты из данных карты Dota 2 (дамп сущностей карты, патчи 7.22/7.23) и переводятся в пиксели изображения калиброванным преобразованием по опорным точкам (src/lib/buildings.ts). Изображение владельца показывается целиком, без растяжения и обрезки.',
  'buildings.hint':
    'Состояние — на конец матча по битмаскам OpenDota; время разрушения показывается только при подтверждённом событии.',
  'buildings.counters': 'Стоит: {standing} · разрушено: {destroyed} · неизвестно: {unknown}',
  'buildings.legendTitle': 'Легенда',
  'buildings.shapeLegend': 'Форма: башня — с зубцами, бараки — с крышей, трон — ромб.',
  'buildings.summaryTableLabel': 'Состояние зданий: {team}',
  'buildings.laneColumn': 'Линия',
  'buildings.barracksColumn': 'Бараки',
  'buildings.baseRow': 'База',
  'buildings.mapImageAlt': 'Карта Dota 2 с расположением зданий',
  'buildings.mapImageMissing':
    'Файл карты public/images/dotaz-map-clean.png не найден: маркеры показаны на нейтральном фоне. Восстановите изображение по указанному пути — карта появится автоматически.',
  'buildings.mapSummaryTitle': 'Сводка по зданиям',
  'buildings.mapNote':
    'Маркеры стоят на местах строений: башня — с зубцами, бараки — с крышей, трон — ромб. Состояние — на конец матча по подтверждённым полям OpenDota; подробная разбивка по линиям и ярусам — ниже.',
  'buildings.legendTeams': 'Radiant — зелёные маркеры, Dire — красные.',

  // --- Общие (Task 15) ---
  'common.technicalDetails': 'Технические подробности',
  'enrich.loaded':
    'Метаданные визуализаций дополнены разовым чтением матча у OpenDota; сохранённый отчёт не изменялся.',
  'enrich.unavailable':
    'Данные для карты зданий и прокачки недоступны: OpenDota не вернула их для этого матча.',
  'abilities.talentsSummary': 'Таланты: {count}',
  'laning.hintShort':
    'Источник: OpenDota · период: {interval}. Поминутные значения берутся из массивов OpenDota и не подменяются статистикой за весь матч.',
  'persistence.rulesMismatch':
    'Отчёт сохранён с версией правил анализа {stored}; текущая версия правил — {current}. Показаны сохранённые наблюдения без пересчёта.',

  // --- Личная история ---
  'history.badge': 'Личные данные',
  'history.title': 'История анализов',
  'history.lead':
    'Сохранённые отчёты доступны только вашему аккаунту: показаны матчи, которые вы проанализировали, и открыть их можно без нового запроса к OpenDota.',
  'history.loading': 'Загружаем историю анализов…',
  'history.waitingAuth': 'Проверяем вашу сессию…',
  'history.signedOut': 'История доступна только после входа в аккаунт.',
  'history.loginLink': 'Войти в аккаунт',
  'history.noDatabaseNote':
    'Анализ матчей по-прежнему доступен на странице матча, но сохранённая история недоступна без настроенного подключения.',
  'history.empty': 'У вас пока нет сохранённых анализов.',
  'history.emptyHint': 'Откройте матч по ID — отчёт сохранится автоматически и появится здесь.',
  'history.emptyCta': 'Проанализировать матч',
  'history.error': 'Не удалось загрузить историю анализов.',
  'history.retry': 'Повторить загрузку',
  'history.matchTitle': 'Матч {id}',
  'history.savedAtLabel': 'Сохранён',
  'history.resultLabel': 'Результат',
  'history.sourceLabel': 'Источник',
  'history.rulesLabel': 'Версия правил',
  'history.rulesMissing': 'не указана',
  'history.status.ready': 'Полный отчёт',
  'history.status.partial': 'Частичный отчёт',
  'history.status.pending': 'Ожидает расчёта',
  'history.status.error': 'Ошибка расчёта',
  'history.openReport': 'Открыть отчёт',
  'history.openUnavailable': 'Открытие недоступно: {status}.',
  'history.result.radiant': 'Победа Света',
  'history.result.dire': 'Победа Тьмы',
  'history.showMore': 'Показать ещё',
  'history.loadingMore': 'Загружаем…',
  'history.incomplete':
    'Показаны последние {count} отчётов. Более ранние можно догрузить — список не является полным.',

  // --- Прочие страницы ---
  'placeholder.badge': 'Функция в разработке',
  'notFound.title': 'Страница не найдена',
  'notFound.text':
    'Такой страницы не существует — возможно, адрес введён с ошибкой или раздел ещё не реализован.',
  'notFound.home': 'Вернуться на главную',

  // --- Периоды анализа ---
  'period.match': 'весь матч',
  'period.laning': '00:00–10:00',

  // --- Известные коды ограничений ---
  'limitation.player.not_in_match':
    'Выбранный участник не найден в данных матча — анализ не выполнен.',
  'limitation.match.kda.partial':
    'Показатели K/D/A неполные — наблюдение по итогу матча не сформировано.',
  'limitation.match.kda.missing': 'Итоговые показатели K/D/A отсутствуют в ответе OpenDota.',
  'limitation.laning.last_hits_at_10.missing':
    'Нет данных о добиваниях к 10-й минуте: поминутный ряд lh_t отсутствует или короче 11 элементов.',
  'limitation.laning.last_hits_at_15.missing':
    'Нет данных о добиваниях к 15-й минуте: поминутный ряд lh_t отсутствует или короче 16 элементов.',
  'limitation.laning.gold_at_10.missing':
    'Нет данных о золоте к 10-й минуте: поминутный ряд gold_t отсутствует или короче 11 элементов.',
  'limitation.laning.gold_at_15.missing':
    'Нет данных о золоте к 15-й минуте: поминутный ряд gold_t отсутствует или короче 16 элементов.',
  'limitation.laning.xp_at_10.missing':
    'Нет данных об опыте к 10-й минуте: поминутный ряд xp_t отсутствует или короче 11 элементов.',
  'limitation.laning.xp_at_15.missing':
    'Нет данных об опыте к 15-й минуте: поминутный ряд xp_t отсутствует или короче 16 элементов.',
  'limitation.laning.events.missing':
    'Журналы событий первых десяти минут (kills_log, deaths_log) отсутствуют или недостоверны.',
  'limitation.laning.events.first_15.missing':
    'Журналы событий первых пятнадцати минут (kills_log, deaths_log) отсутствуют или недостоверны.',
  'limitation.laning.events.partial':
    'Журналы убийств и смертей ранней стадии доступны не полностью — наблюдение не сформировано.',
  'limitation.laning.purchases.missing':
    'Журнал покупок недоступен — количество покупок первых десяти минут не определено.',
  'limitation.laning.purchases_first_15.missing':
    'Журнал покупок недоступен — количество покупок первых пятнадцати минут не определено.',
  'limitation.laning.efficiency_pct.missing':
    'Показатель эффективности линии (lane_efficiency_pct) отсутствует в ответе OpenDota.',
  'limitation.benchmarks.hero_role_missing':
    'Нормы героя и роли не подтверждены: сравнение с другими игроками, оценка качества линии и рекомендации не выполняются.',
  'limitation.match.id.missing':
    'Ответ OpenDota не содержит ID матча: соответствие данных подтверждено только по адресу запроса.',
  'limitation.match.id.mismatch':
    'ID матча в ответе OpenDota не совпадает с запрошенным.',
  'limitation.match.duration.missing':
    'Длительность матча отсутствует или некорректна в ответе OpenDota.',
  'limitation.match.winner.missing': 'Победитель матча не указан в ответе OpenDota.',
  'limitation.players.empty':
    'В ответе OpenDota нет ни одного участника с корректным player_slot.',
  'limitation.players.incomplete': 'Часть данных матча недоступна: получены не все участники.',
  'limitation.report.match_payload.missing':
    'Снимок данных матча отсутствует: запись отчёта не завершена (payload не записан).',
  'limitation.report.analysis_payload.missing':
    'Снимок анализа отсутствует: запись отчёта не завершена (payload не записан).',

  // --- Task 16: нормативы первых 15 минут ---
  'bench.title': 'Нормативы за первые 15 минут ({interval})',
  'bench.metric.lastHits': 'LH к 15:00',
  'bench.metric.gold': 'Золото к 15:00',
  'bench.metric.xp': 'Опыт к 15:00',
  'bench.column.metric': 'Показатель',
  'bench.column.actual': 'Факт',
  'bench.column.median': 'Медиана',
  'bench.column.range': 'p25–p75',
  'bench.column.diff': 'Разница',
  'bench.column.sample': 'Выборка',
  'bench.role.safe': 'лёгкая линия',
  'bench.role.mid': 'центральная линия',
  'bench.role.off': 'сложная линия',
  'bench.role.jungle': 'лес',
  'bench.role.unknown': 'линия не определена',
  'bench.status.missingRole':
    'Линия игрока не определена — сравнение с нормативами не выполняется.',
  'bench.status.missingPatch':
    'Патч матча не подтверждён — сравнение с нормативами недоступно.',
  'bench.status.patchMismatch':
    'Матч относится к другому патчу: нормативы доступны только за патч {patch}.',
  'bench.status.intervalMismatch':
    'Отчёт построен за интервал {actual}, а нормативы — за {expected} минут: сравнение не выполняется.',
  'bench.status.noBenchmark':
    'Для этого героя и линии нет сопоставимых данных за текущий патч.',
  'bench.status.insufficient': 'недостаточно наблюдений',
  'bench.status.noSample': 'нет наблюдений',
  'bench.status.missingActual': 'нет данных у игрока',
  'bench.status.medianOnly': 'только медиана (малая выборка)',
  'bench.meta': 'Норматив: патч {patch}, источник — {source}, снапшот от {generated}.',
  'bench.limitations':
    'Это статистика, а не оценка игры: значение выше или ниже медианы не означает «хорошо» или «плохо». Выборка — открытые данные OpenDota; MMR игроков не учитывается.',
  'bench.methodVersion':
    'Методика {version}: медиана и квартили (p25/p50/p75). Пороги показа: медиана от {medianOnly} наблюдений, квартили от {full}.',
  'bench.unavailable':
    'Нормативы недоступны: снапшот не загружен или не прошёл проверку.',

  // --- Task 17: находки и рекомендации ---
  'insights.title': 'Анализ ошибок и рекомендации',
  'insights.lead':
    'Наблюдения по первым 15 минутам. Отклонение от медианы не доказывает ошибку — это повод пересмотреть эпизод.',
  'insights.severity.warning': 'Стоит посмотреть',
  'insights.severity.info': 'Наблюдение',
  'insights.source.benchmark': 'Сравнение с нормативами {patch} (OpenDota)',
  'insights.source.event': 'Подтверждённые события матча (OpenDota)',
  'insights.recommendationLabel': 'Рекомендация',
  'insights.empty':
    'Поддерживаемых проблем не обнаружено: доступные показатели не выходят за границы типичного диапазона.',
  'insights.unavailable': 'Анализ недоступен: для выбранного игрока нет данных ранней стадии.',
  'insights.noBenchmark':
    'Статистические сравнения недоступны (нормативы не загружены) — показаны только подтверждённые события.',
  'insights.hidden': 'Дополнительных наблюдений скрыто: {count}.',
  'insights.method':
    'Правила рекомендаций {version}; нормативы {benchmark}. Сравнение не является оценкой качества игры.',
  'insights.sample': 'выборка {sample}',
  'insights.smallSample': 'малая выборка — сравнение только с медианой',
  'insights.lh.belowRange.title': 'Добивания ниже типичного диапазона',
  'insights.lh.belowMedian.title': 'Добивания ниже медианы',
  'insights.lh.aboveRange.title': 'Добивания выше типичного диапазона',
  'insights.gold.belowRange.title': 'Золото ниже типичного диапазона',
  'insights.gold.belowMedian.title': 'Золото ниже медианы',
  'insights.gold.aboveRange.title': 'Золото выше типичного диапазона',
  'insights.xp.belowRange.title': 'Опыт ниже типичного диапазона',
  'insights.xp.belowMedian.title': 'Опыт ниже медианы',
  'insights.xp.aboveRange.title': 'Опыт выше типичного диапазона',
  'insights.metric.lastHits.description':
    'К 15:00 у игрока {actual} добитых крипов. Медиана для этого героя и линии — {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.lastHits.recommendation':
    'Пересмотри первые 15 минут: стабильность добивания и возможности фарма рядом с линией.',
  'insights.metric.gold.description':
    'К 15:00 накоплено {actual} золота. Медиана для этого героя и линии — {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.gold.recommendation':
    'Проверь эффективность фарма и отрезки, когда золото почти не поступало.',
  'insights.metric.xp.description':
    'К 15:00 накоплено {actual} опыта. Медиана для этого героя и линии — {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.xp.recommendation':
    'Обрати внимание на присутствие на линии и время вне зон получения опыта.',
  'insights.farming.title': 'Фарм ниже типичного диапазона',
  'insights.farming.description':
    'К 15:00: {lhActual} добитых (медиана {lhMedian}) и {goldActual} золота (медиана {goldMedian}); {sample}.',
  'insights.farming.recommendation':
    'Разбери первые 15 минут: стабильность добивания и периоды без прироста золота. Причинность по этим данным не определяется.',
  'insights.deaths.warning.title': 'Несколько смертей в первые 15 минут: {count}',
  'insights.deaths.info.title': 'Смерть в первые 15 минут: {count}',
  'insights.deaths.description':
    'Подтверждено событие: смертей за интервал — {count}. Причины и обстоятельства в данных OpenDota отсутствуют.',
  'insights.deaths.recommendation':
    'Разбери эпизоды смертей: прерывали ли они фарм и получение опыта.',
  'insights.kills.title': 'Участие в убийствах: {count}',
  'insights.kills.description':
    'Подтверждено убийств с участием игрока в первые 15 минут: {count}.',
  'insights.kills.recommendation':
    'Сравнивай с задачей роли: у поддержки меньше добиваний и убийств — это не ошибка.',

  // --- Task 19: каталог героев, профили, статистика, матчапы ---
  'heroes.title': 'Герои',
  'heroes.description':
    'Полный каталог героев Dota 2: поиск, фильтр по основному атрибуту и профили с проверенными характеристиками.',
  'heroes.search.label': 'Поиск героя',
  'heroes.search.placeholder': 'Например, Phantom или Assassin',
  'heroes.search.clear': 'Очистить поиск',
  'heroes.filter.legend': 'Основной атрибут',
  'heroes.filter.any': 'Все',
  'heroes.filter.str': 'Сила',
  'heroes.filter.agi': 'Ловкость',
  'heroes.filter.int': 'Интеллект',
  'heroes.filter.universal': 'Универсальный',
  'heroes.sort.label': 'Сортировка',
  'heroes.sort.name': 'По названию',
  'heroes.sort.winRate': 'По винрейту',
  'heroes.sort.pickRate': 'По доле выборов',
  'heroes.count': 'Найдено героев: {count} из {total}.',
  'heroes.empty': 'Ни один герой не подходит под запрос и фильтр.',
  'heroes.emptyHint': 'Измените запрос или выберите другой атрибут.',
  'heroes.loading': 'Загружаем статистику героев…',
  'heroes.statsUnavailable':
    'Статистика матчей недоступна: справочник героев показан полностью, винрейт и доля выборов скрыты.',
  'heroes.card.open': 'Открыть профиль героя',
  'heroes.card.winRate': 'винрейт',
  'heroes.card.pickRate': 'доля выборов',
  'heroes.imageFallback': 'нет портрета',
  'heroes.attr.str': 'Сила',
  'heroes.attr.agi': 'Ловкость',
  'heroes.attr.int': 'Интеллект',
  'heroes.attr.all': 'Универсальный',
  'heroes.attack.Melee': 'Ближний бой',
  'heroes.attack.Ranged': 'Дальний бой',

  'hero.back': 'К каталогу героев',
  'hero.notFound.title': 'Герой не найден',
  'hero.notFound.text': 'Такого героя нет в проверенном справочнике. Проверьте адрес страницы.',
  'hero.errors.retry': 'Повторить загрузку',
  'hero.section.attributes': 'Характеристики',
  'hero.section.stats': 'Статистика матчей',
  'hero.section.matchups': 'Матчапы',
  'hero.section.abilities': 'Способности',
  'hero.section.talents': 'Таланты',
  'hero.section.facets': 'Фасеты',
  'hero.section.items': 'Популярные предметы',
  'hero.attributes.str': 'Сила',
  'hero.attributes.agi': 'Ловкость',
  'hero.attributes.int': 'Интеллект',
  'hero.attributes.all': 'Универсальный',
  'hero.attributes.base': 'база',
  'hero.attributes.gain': 'рост',
  'hero.attributes.damage': 'Урон',
  'hero.attributes.attackRange': 'Дальность атаки',
  'hero.attributes.attackType': 'Тип атаки',
  'hero.attributes.attackRate': 'Интервал атаки',
  'hero.attributes.baseAttackTime': 'Базовая атака',
  'hero.attributes.attackPoint': 'Точка атаки',
  'hero.attributes.projectileSpeed': 'Скорость снаряда',
  'hero.attributes.moveSpeed': 'Скорость передвижения',
  'hero.attributes.armor': 'Броня',
  'hero.attributes.mr': 'Сопротивление магии',
  'hero.attributes.health': 'Здоровье',
  'hero.attributes.mana': 'Мана',
  'hero.attributes.legs': 'Ног',
  'hero.attributes.vision': 'Обзор',
  'hero.attributes.roles': 'Роли',
  'hero.attributes.snapshot':
    'Снимок справочника OpenDota от {date}. Это эталонные характеристики героя, а не статистика матчей; патч провайдером не указывается.',
  'hero.attributes.unavailable': 'Характеристики недоступны в справочнике.',

  'hero.stats.pub': 'Публичные матчи',
  'hero.stats.turbo': 'Turbo',
  'hero.stats.pro': 'Профессиональные',
  'hero.stats.pickShare': 'Доля выборов героя',
  'hero.stats.games': 'Выборов: {count}',
  'hero.stats.wins': 'Побед: {count}',
  'hero.stats.bans': 'Банов: {count}',
  'hero.stats.bansMissing': 'Баны: провайдер значение не сообщил',
  'hero.stats.pickShareNote':
    'Доля выборов = pub_pick героя / сумма pub_pick всех героев в выборке провайдера: это доля среди записанных выборов героев, а не доля матчей с этим героем.',
  'hero.stats.winRate': 'Винрейт: {value}',
  'hero.stats.noPatch':
    'Провайдер не сообщает ни патч, ни период наблюдений: это статистика выборки OpenDota, а не мета текущего патча.',
  'hero.stats.retrievedAt': 'Данные получены: {time} (момент запроса, не период наблюдений).',
  'hero.stats.unavailable':
    'Статистика матчей недоступна: сервис не ответил. Характеристики и способности показаны из справочника.',
  'hero.stats.empty': 'Для этого героя статистика в выборке провайдера отсутствует.',
  'hero.stats.ranks': 'Ранговые брекеты',
  'hero.stats.rankLabel': 'Брекет {rank}',

  'hero.matchups.strongest': 'Пять наиболее успешных матчапов',
  'hero.matchups.weakest': 'Пять наименее успешных матчапов',
  'hero.matchups.lead':
    'Винрейт выбранного героя против соперника. Это наблюдение, а не «контрпик»: причинность по этим данным не определяется.',
  'hero.matchups.minGames': 'В рейтинг входят пары не менее {count} матчей.',
  'hero.matchups.games': 'Матчей: {count}',
  'hero.matchups.wins': 'Побед: {count}',
  'hero.matchups.winRate': 'Винрейт {value}',
  'hero.matchups.loading': 'Загружаем матчапы…',
  'hero.matchups.error':
    'Матчапы недоступны: провайдер не ответил. Остальные разделы профиля работают.',
  'hero.matchups.empty': 'В ответе провайдера нет матчапов для этого героя.',
  'hero.matchups.insufficient':
    'После порога {count} матчей не осталось пар: ранжирование не строится, чтобы не выдавать шум за результат.',
  'hero.matchups.limited':
    'Подходящих пар меньше десяти: группы не пересекаются, поэтому одна из них короче пяти.',
  'hero.matchups.source':
    'Источник: OpenDota /heroes/{hero}/matchups. Провайдер не указывает патч, бракет, режим и период наблюдений.',
  'hero.matchups.open': 'Открыть профиль соперника',
  'hero.matchups.noSample': 'нет пар с достаточной выборкой',

  'hero.abilities.loading': 'Загружаем способности…',
  'hero.abilities.error':
    'Справочник способностей недоступен: провайдер не ответил. Ничего не подставляется.',
  'hero.abilities.empty': 'Провайдер не вернул способности для этого героя.',
  'hero.abilities.type': 'Тип',
  'hero.abilities.damage': 'Урон',
  'hero.abilities.target': 'Цель',
  'hero.abilities.immune': 'Сквозь иммунитет',
  'hero.abilities.dispellable': 'Рассеивается',
  'hero.abilities.noDescription': 'Описание недоступно в источнике.',
  'hero.abilities.descriptionFallback':
    'Русский перевод описания пока отсутствует — показан текст источника.',
  'hero.abilities.missingDescriptions':
    'У части способностей ({count}) провайдер не отдал описание — это состояние источника, а не ошибка расчёта.',
  'hero.abilities.values': 'Значения',
  'hero.abilities.innate': 'Врождённая',
  'hero.abilities.innateCount': 'Врождённых способностей в справочнике: {count}.',
  'hero.abilities.standardTitle': 'Обычные способности',
  'hero.abilities.innateTitle': 'Врождённые способности',
  'hero.abilities.coverage':
    'Способностей из справочника: {total}; с описанием: {described}; без описания: {missing}.',
  'hero.abilities.additionalNote':
    'Провайдер помечает только врождённые способности; отдельной пометки «дополнительная» он не отдаёт, поэтому субспособности и способности с нестандартными слотами показаны в группе обычных без придуманной категории.',
  'hero.abilities.noDisplayName': 'техническое имя',
  'hero.abilities.missingNames':
    'У части способностей ({count}) провайдер не отдал отображаемое имя — показано техническое имя из справочника.',
  'hero.abilities.descriptionLanguage':
    'Описания способностей приводятся на языке источника (английский); перевод игровой механики не додумывается.',

  'hero.talents.level': 'Уровень {level}',
  'hero.talents.empty': 'Таланты в справочнике отсутствуют.',
  'hero.talents.noName': 'название недоступно',

  'hero.facets.empty': 'Активных фасетов в справочнике нет.',
  'hero.facets.noDescription': 'Описание фасета недоступно в источнике.',
  'hero.facets.missingDescriptions':
    'У части активных фасетов ({count}) провайдер не отдал описание — это состояние источника.',
  'hero.facets.deprecated':
    'Устаревшие фасеты провайдера не показываются, чтобы не выдавать старые данные за текущие.',

  'hero.items.phase.start': 'Стартовая закупка',
  'hero.items.phase.early': 'Ранняя игра',
  'hero.items.phase.mid': 'Средняя игра',
  'hero.items.phase.late': 'Поздняя игра',
  'hero.items.count': 'Вхождений: {count}',
  'hero.items.note':
    'Счётчики вхождений из выборки OpenDota: знаменатель провайдер не публикует, поэтому проценты не вычисляются, а популярность не означает оптимальность.',
  'hero.items.loading': 'Загружаем популярные предметы…',
  'hero.items.error': 'Популярные предметы недоступны: провайдер не ответил.',
  'hero.items.empty': 'Провайдер не вернул популярные предметы для этого героя.',
  'hero.openProfile': 'Профиль героя',
  'team.openHeroProfile': 'Открыть профиль героя',

  // --- Task 18: тайминги покупок предметов ---

  'itemTimings.title': 'Анализ покупки предметов',
  'itemTimings.lead':
    'Таймлайн подтверждённых покупок выбранного игрока. Время — момент события из журнала OpenDota, а не момент завершения сборки предмета.',
  'itemTimings.noLog': 'Журнал покупок недоступен: показать тайминги нельзя.',
  'itemTimings.empty': 'В журнале покупок нет событий для отображения.',
  'itemTimings.repeat': 'покупка №{count}',
  'itemTimings.unknown': 'предмет вне каталога',
  'itemTimings.median': 'медиана {time}',
  'itemTimings.sample': 'выборка {count}',
  'itemTimings.hiddenConsumables': 'Скрыто обычных расходников: {count}.',
  'itemTimings.hiddenRecipes': 'Скрыто рецептов: {count}.',
  'itemTimings.repeated': 'Предметов с повторными покупками: {count}.',
  'itemTimings.hiddenByLimit': 'Событий не показано из-за лимита: {count}.',
  'itemTimings.droppedInvalid':
    'Записей без корректного времени отброшено: {count} (время не подменяется нулём).',
  'itemTimings.noBenchmarks':
    'Сравнение с нормативами таймингов недоступно: датасет не загружен или не подтверждён. Показаны только фактические времена покупок.',
  'itemTimings.medianNote':
    'Сравнение описывает статистику игроков, купивших предмет. Медиана — не «оптимальное» время, а поздняя покупка не является ошибкой.',
  'itemTimings.class.early': 'раньше типичного',
  'itemTimings.class.typical': 'в типичном диапазоне',
  'itemTimings.class.late': 'позже типичного',
  'itemTimings.class.insufficient': 'мало данных',
  'itemTimings.class.noSample': 'нет наблюдений',
  'itemTimings.purchased': 'куплено {time}',
  'itemTimings.col.median': 'медиана',
  'itemTimings.col.range': 'диапазон',
  'itemTimings.col.difference': 'отличие',
  'itemTimings.col.sample': 'выборка',
  'itemTimings.col.timing': 'тайминг',
  'itemTimings.insufficientSample':
    'Выборка {count} наблюдений меньше порога {min}: класс тайминга не присваивается, шкала не строится.',
  'itemTimings.rowNoBenchmark': 'Нет норматива для этого героя, линии и патча.',
  'itemTimings.repeatNoCompare': 'Повторная покупка: сравнение относится только к первой.',
  'itemTimings.scale.aria':
    'Шкала тайминга: покупка {actual}; медиана {median}; типичный диапазон {p25}–{p75}; выборка {count} наблюдений; {position}.',
  'itemTimings.scale.legend': '◆ покупка · │ медиана · ▬ p25–p75',
  'itemTimings.scale.position.before': 'покупка раньше типичного диапазона',
  'itemTimings.scale.position.in': 'покупка внутри типичного диапазона',
  'itemTimings.scale.position.after': 'покупка позже типичного диапазона',
  'itemTimings.thresholdNote':
    'Классификация и шкала показываются только при выборке не менее {min} наблюдений. Порог — продуктовое правило, а не доказательство статистической значимости.',
  'itemTimings.thresholds':
    'Пороги снапшота: сохранение бакета {store}, квартили {full}, классификация {classify} наблюдений.',
  'itemTimings.source': 'Источник: журнал покупок OpenDota (purchase_log).',
  'itemTimings.method':
    'Методика таймингов {version}; патч {patch}. Сравнение — только для того же героя, линии и патча.',
} as const

export type TranslationKey = keyof typeof ru

export const translations: Record<Locale, Record<TranslationKey, string>> = { ru, en }

/** Проверка значения из внешнего источника (например, localStorage). */
export function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en'
}

/**
 * Подстановка переменных вида `{name}` в шаблон перевода.
 * Неизвестные плейсхолдеры остаются как есть — так ошибка в ключе видна сразу.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (params === undefined) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}
