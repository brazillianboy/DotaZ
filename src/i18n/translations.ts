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
  'match.phase.checkingReport': 'Проверяем сохранённый отчёт…',
  'match.phase.fetching': 'Запрашиваем данные матча у OpenDota…',
  'match.phase.analyzing': 'Формируем наблюдения по всем участникам…',
  'match.phase.saving': 'Сохраняем отчёт в личную историю…',
  'match.phase.session': 'Проверяем состояние сессии…',
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
  'match.stats.gpm': 'GPM',
  'match.stats.xpm': 'XPM',
  'match.stats.lastHits': 'Last hits',
  'match.stats.hint':
    'Значения приведены как есть из ответа OpenDota. «Нет данных» означает отсутствие поля в ответе и не заменяется нулём. Last hits — показатель за матч, а не за первые 10 минут. Разбор линии и наблюдения показаны ниже.',

  // --- Стадия линии 00:00–10:00 ---
  'laning.title': 'Стадия линии — 00:00–10:00',
  'laning.empty': 'Выберите участника, чтобы увидеть данные стадии линии.',
  'laning.unavailable':
    'Детальные данные стадии линии для этого матча недоступны: OpenDota не вернула поминутные ряды и журналы событий (реплей не обработан). Отсутствующие значения не подменяются нулями.',
  'laning.lastHits': 'Добивания к 10:00',
  'laning.gold': 'Золото к 10:00',
  'laning.xp': 'Опыт к 10:00',
  'laning.kills': 'Убийства 00:00–10:00',
  'laning.deaths': 'Смерти 00:00–10:00',
  'laning.efficiency': 'Эффективность линии (OpenDota)',
  'laning.purchasesTitle': 'Покупки 00:00–10:00:',
  'laning.purchasesMissing': 'Журнал покупок недоступен в ответе OpenDota.',
  'laning.purchasesEmpty': 'В интервале 00:00–10:00 покупок нет (журнал получен).',
  'laning.hint':
    'Источник: OpenDota. Период: 00:00–10:00. Поминутные показатели берутся из массивов OpenDota (индекс 10 соответствует 10:00) и не подменяются статистикой за весь матч; события фильтруются по времени в секундах. «Нет данных» означает отсутствие поля в ответе. Оценки качества линии не выполняются: подтверждённые нормы героя и роли появятся в следующих задачах.',

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
  'history.result.radiant': 'Победа Radiant',
  'history.result.dire': 'Победа Dire',
  'history.showMore': 'Показать ещё',
  'history.loadingMore': 'Загружаем…',
  'history.incomplete':
    'Показаны последние {count} отчётов. Более ранние можно догрузить — список не является полным.',

  // --- Прочие страницы ---
  'heroes.title': 'Персонажи',
  'heroes.description':
    'Каталог героев, винрейты, пики, предметы и средние показатели появятся позже — после подтверждения источника данных и методики расчёта. Сейчас это дизайн-заготовка раздела.',
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
  'limitation.laning.gold_at_10.missing':
    'Нет данных о золоте к 10-й минуте: поминутный ряд gold_t отсутствует или короче 11 элементов.',
  'limitation.laning.xp_at_10.missing':
    'Нет данных об опыте к 10-й минуте: поминутный ряд xp_t отсутствует или короче 11 элементов.',
  'limitation.laning.events.missing':
    'Журналы событий первых десяти минут (kills_log, deaths_log) отсутствуют или недостоверны.',
  'limitation.laning.purchases.missing':
    'Журнал покупок недоступен — количество покупок первых десяти минут не определено.',
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
