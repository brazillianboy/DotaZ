import type { TranslationKey } from './translations'

/**
 * Английский словарь (Task 13).
 *
 * Обязан содержать все ключи русского словаря — паритет проверяется тестами.
 * Технические идентификаторы (имена полей OpenDota, rule_id, match_id) не переводятся.
 */
export const en: Record<TranslationKey, string> = {
  // --- Общие ---
  'common.noData': 'No data',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.backHome': '← Back to Home',
  'common.goHome': 'Go to home',
  'common.check': 'Checking…',
  'common.sourceLabel': 'Source: {source}',
  'common.periodLabel': 'Period: {period}',
  'common.skippedRecords':
    'Some records are not shown: unusable metadata ({count}). Data was not changed or deleted.',

  // --- Навигация и шапка ---
  'nav.home': 'Home',
  'nav.heroes': 'Heroes',
  'nav.meta': 'Meta',
  'nav.history': 'History',
  'nav.about': 'About',
  'nav.sectionSoon': 'Section will appear later',
  'nav.mainLabel': 'Main navigation',
  'nav.brandHome': 'DotaZ — go to home',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',
  'nav.skipToContent': 'Skip to content',
  'nav.login': 'Log in',
  'nav.register': 'Sign up',
  'nav.logout': 'Log out',
  'nav.loggingOut': 'Logging out…',
  'nav.logoutFailed': 'Could not log out. Please try again.',

  // --- Переключатель языка ---
  'language.label': 'Interface language',
  'language.ru': 'Русский',
  'language.en': 'English',
  'language.switchTo': 'Switch to {language}',

  // --- Подвал ---
  'footer.note':
    'Educational Dota 2 match analysis concept: matches loaded from OpenDota, statistics, evidence-based observations and a private report history.',

  // --- Главная страница ---
  'home.titlePrefix': 'Analyse your Dota 2 matches and improve with',
  'home.lead':
    'Break down matches, get trustworthy statistics and evidence-based observations, and keep an eye on the meta. Everything you need to grow — in one place.',
  'home.formLabel': 'Match lookup form',
  'home.inputPlaceholder': 'Enter a match ID (for example, 9007760151)',
  'home.inputLabel': 'Match ID',
  'home.submit': 'Analyse',
  'home.howToFindTitle': 'Where do I find a match ID?',
  'home.howToFindExample': 'Example:',
  'home.howToFindText':
    'The match ID is used to request OpenDota data: statistics for all participants, a 00:00–10:00 laning report and observations based on confirmed facts.',
  'home.featuresTitle': 'Planned platform capabilities',
  'home.feature.analytics.title': 'Detailed analytics',
  'home.feature.analytics.text': 'Statistics, observations and recommendations.',
  'home.feature.meta.title': 'Meta information',
  'home.feature.meta.text': 'Current heroes and strategies.',
  'home.feature.lane.title': 'Lane analysis',
  'home.feature.lane.text': 'Breakdown of the first 10 minutes of a match.',
  'home.feature.averages.title': 'Average metrics',
  'home.feature.averages.text': 'Comparison with other players.',
  'home.feature.history.title': 'Private history',
  'home.feature.history.text': 'Every analysed match.',
  'home.feature.languages.title': 'Russian and English',
  'home.feature.languages.text': 'Pick the language you prefer.',
  'home.stepsTitle': 'How does it work?',
  'home.step1.title': 'Enter a match ID',
  'home.step1.text': 'Copy the ID from Dota 2 and paste it here.',
  'home.step2.title': 'We analyse',
  'home.step2.text': 'We fetch data from OpenDota and analyse the match.',
  'home.step3.title': 'Get results',
  'home.step3.text': 'Review statistics, observations and analysis limitations.',
  'home.step4.title': 'Improve',
  'home.step4.text': 'Use confirmed facts and track your progress.',
  'home.guideLabel': 'Platform sections',
  'home.guide.heroes.title': 'Heroes',
  'home.guide.heroes.text': 'The section will appear once the data source is confirmed.',
  'home.guide.meta.title': 'Current meta',
  'home.guide.meta.text': 'Follow the trends and strong heroes of the current patch.',
  'home.guide.meta.note': 'Section in development — no link yet.',
  'home.guide.example.title': 'Example analysis',
  'home.guide.example.text': 'See what a detailed match report looks like.',
  'home.guide.history.title': 'Match history',
  'home.guide.history.text': 'All your analyses in one place.',
  'home.soon': 'Soon',
  'home.preview.aria': 'Example match card — design preview with demonstration data',
  'home.preview.badge': 'Design preview',
  'home.preview.link': 'View an example analysis →',
  'home.preview.note': 'Demonstration data, not from OpenDota.',

  // --- Ошибки OpenDota и валидации ---
  'errors.matchId.empty': 'Enter a match ID.',
  'errors.matchId.digits': 'The match ID must contain digits only (a positive integer).',
  'errors.matchId.positive': 'The match ID must be a positive number.',
  'errors.matchId.tooLong': 'The match ID is too long — please check your input.',
  'errors.opendota.not_found': 'Match not found. Check the ID and try again.',
  'errors.opendota.forbidden':
    'OpenDota rejected the request (access restricted, HTTP {status}). This is a provider access limit, not a missing match.',
  'errors.opendota.rate_limited': 'OpenDota request limit exceeded. Please try again later.',
  'errors.opendota.server_error': 'The OpenDota service is temporarily unavailable (server error). Please try again later.',
  'errors.opendota.unexpected_status': 'OpenDota returned an unexpected response (HTTP {status}). Please try again later.',
  'errors.opendota.network': 'The network is unavailable or OpenDota is not responding. Check your connection and try again.',
  'errors.opendota.timeout': 'The OpenDota request timed out (15 seconds). Please try again.',
  'errors.opendota.invalid_response': 'Could not process the OpenDota response: the data is invalid.',
  'errors.opendota.aborted': 'The request was cancelled.',
  'errors.opendota.unexpected': 'Could not load the match. Please try again later.',
  'errors.opendota.httpStatus': 'Response HTTP status: {status}',
  'errors.opendota.checkId': 'Check the match ID: it may be incorrect.',

  // --- Аутентификация ---
  'auth.loginTitle': 'Log in',
  'auth.registerTitle': 'Sign up',
  'auth.checkingSession': 'Checking the session…',
  'auth.emailLabel': 'Email',
  'auth.passwordLabel': 'Password',
  'auth.passwordConfirmLabel': 'Repeat the password',
  'auth.emailPlaceholder': 'you@example.com',
  'auth.passwordPlaceholder': '••••••••',
  'auth.submitLogin': 'Log in',
  'auth.submittingLogin': 'Logging in…',
  'auth.submitRegister': 'Sign up',
  'auth.submittingRegister': 'Creating the account…',
  'auth.noAccountHint': 'No account yet?',
  'auth.registerLink': 'Sign up',
  'auth.haveAccountHint': 'Already have an account?',
  'auth.loginLink': 'Log in',
  'auth.alreadyLoggedIn': 'You are already logged in ({email}).',
  'auth.alreadyLoggedInNoRegister': 'You are already logged in ({email}) — no registration needed.',
  'auth.notConfiguredLogin':
    'Authentication is unavailable: Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local .env (see .env.example) and restart the dev server.',
  'auth.notConfiguredRegister':
    'Registration is unavailable: Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local .env (see .env.example) and restart the dev server.',
  'auth.checkEmailTitle': 'Check your email',
  'auth.checkEmailText':
    'If registration is available for this address, you will receive an email with further instructions. If you already have an account, try logging in.',
  'auth.goToLogin': 'Go to login',
  'auth.signedIn': 'Account created — you are signed in.',
  'auth.error.emailRequired': 'Enter an email.',
  'auth.error.passwordRequired': 'Enter a password.',
  'auth.error.passwordMismatch': 'The passwords do not match.',
  'auth.error.notConfigured':
    'Authentication is temporarily unavailable: Supabase is not configured. Please contact the project administrator.',
  'auth.error.generic': 'The operation failed. Please try again later.',
  'auth.error.network':
    'The network is unavailable or the service is not responding. Check your internet connection and try again.',
  'auth.error.invalidCredentials': 'Incorrect email or password.',
  'auth.error.emailNotConfirmed':
    'The email is not confirmed yet. Check your inbox and follow the link in the email.',
  'auth.error.alreadyRegistered': 'An account with this email may already exist. Try logging in.',
  'auth.error.rateLimited': 'Too many attempts. Please wait a moment and try again.',
  'auth.error.weakPassword':
    'The password does not meet the Supabase project requirements. Choose a longer password.',
  'auth.error.invalidEmail': 'The email address is invalid.',
  'auth.error.signupDisabled': 'Registration is temporarily disabled in the project settings.',
  'auth.error.linkInvalid': 'The link is invalid or expired. Request a new email.',
  'auth.confirm.title': 'Email confirmation',
  'auth.confirm.pending': 'Confirming your account…',
  'auth.confirm.notConfigured':
    'Confirmation is unavailable: Supabase is not configured. Check the application environment variables.',
  'auth.confirm.invalidLink': 'The confirmation link is invalid or expired. Request a new email.',
  'auth.confirm.hashFailed': 'Could not process the confirmation data. Request a new email.',
  'auth.confirm.missingData': 'The confirmation link contains no data. Request a new email.',
  'auth.confirm.success': 'Email confirmed — the account is active. You can now log in.',
  'auth.guard.badge': 'Access check',
  'auth.guard.title': 'Checking authorization…',
  'auth.guard.text':
    'Checking your session. If you are signed in, the private section will open automatically.',

  // --- Страница матча ---
  'match.badge': 'OpenDota data',
  'match.title': 'Match {id}',
  'match.idInResponse': 'Match ID in the response',
  'match.duration': 'Duration',
  'match.durationSeconds': '({seconds} s)',
  'match.winner': 'Winner',
  'match.playersInResponse': 'Participants in the response',
  'match.source': 'Data source',
  'match.loadingBadge': 'Loading',
  'match.phase.checkingReport': 'Checking the saved report…',
  'match.phase.fetching': 'Requesting match data from OpenDota…',
  'match.phase.analyzing': 'Building observations for every participant…',
  'match.phase.saving': 'Saving the report to your history…',
  'match.phase.session': 'Checking the session state…',
  'match.phase.requestingParse': 'Requesting replay parsing…',
  'match.phase.waitingParse': 'OpenDota is processing the replay…',
  'match.phase.refetching': 'Preparing the first 15 minutes of analysis…',
  'match.invalid.badge': 'Invalid ID',
  'match.invalid.title': 'Check the match ID',
  'match.invalid.note':
    'No request was sent to OpenDota: the match ID must be a positive integer.',
  'match.error.badge': 'Request error',
  'match.error.title': 'Could not load match {id}',
  'match.error.sourceLine': 'Data source: OpenDota (the request failed)',
  'match.error.retry': 'Retry the request',
  'match.reportError.badge': 'Saved report unavailable',
  'match.reportError.title': 'Could not display the saved report for match {id}',
  'match.reportError.note':
    'The database record was not changed: a damaged or unknown report format is never overwritten automatically, and no new report was created for this match.',
  'match.players.title': 'Participants',
  'match.players.empty': 'No participant data available.',
  'match.players.unknownTeam': 'Team not determined',
  'match.players.selected': 'Selected',
  'match.players.playerLabel': 'Player — slot {slot}',
  'match.players.heroSuffix': ' · hero {heroId}',
  'match.stats.title': 'Player statistics',
  'match.stats.empty': 'Select a participant to see their statistics.',
  'match.stats.slot': 'Slot',
  'match.stats.team': 'Side',
  'match.stats.heroId': 'Hero (hero_id)',
  'match.stats.kda': 'K / D / A',
  'match.stats.gpm': 'GPM',
  'match.stats.xpm': 'XPM',
  'match.stats.lastHits': 'Last hits',
  'match.stats.hint':
    'Values are shown exactly as returned by OpenDota. "No data" means the field is missing from the response and is never replaced with zero. Last hits is a whole-match metric, not the first 10 minutes. The laning report and observations are shown below.',

  // --- Ранняя стадия 00:00–15:00 ---
  'laning.title': 'Laning stage — {interval}',
  'laning.empty': 'Select a participant to see the laning stage data.',
  'laning.unavailable':
    'Detailed early-stage data is unavailable for this match: OpenDota did not return minute series and event logs (the replay was not parsed). Missing values are never replaced with zeros.',
  'laning.lastHits': 'Last hits at {minute}',
  'laning.gold': 'Gold at {minute}',
  'laning.xp': 'Experience at {minute}',
  'laning.kills': 'Kills {interval}',
  'laning.deaths': 'Deaths {interval}',
  'laning.efficiency': 'Lane efficiency (OpenDota)',
  'laning.purchasesTitle': 'Purchases {interval}:',
  'laning.purchasesMissing': 'The purchase log is unavailable in the OpenDota response.',
  'laning.purchasesEmpty':
    'No displayable items in the {interval} interval (the log was received; ordinary consumables are hidden).',
  'laning.purchasesHidden': 'Ordinary consumables hidden: {count}.',
  'laning.purchasesNote':
    'Components and completed items of the interval are shown; ordinary consumables (Tango, Clarity, Healing Salve, Enchanted Mango, Faerie Fire, wards, Smoke of Deceit, Dust of Appearance, Town Portal Scroll) are hidden. The exceptions are always shown: Bottle, Aghanim’s Shard, Refresher Shard, Cheese, Block of Cheese.',
  'laning.hint':
    'Source: OpenDota. Period: {interval}. Minute values come from the OpenDota arrays (index 15 corresponds to 15:00) and are never replaced with whole-match statistics; events are filtered by time in seconds and purchases also by item type (ordinary consumables are hidden). "No data" means the field is missing from the response. Lane quality is not graded: confirmed hero and role benchmarks are not part of the current version.',

  // --- Items for the match ---
  'items.title': 'Items for the Match',
  'items.lead':
    'Meaningful acquisitions over the whole match: the time is the first purchase in the OpenDota log. Completed items, Bottle and basic Boots of Speed without a confirmed upgrade are shown; components, ordinary consumables and recipes are hidden — the detailed purchase list for the interval is in the lane stage report.',
  'items.selectPlayer': 'Select a participant to see items.',
  'items.empty':
    'No meaningful acquisitions recorded: the log has no completed items, Bottle or basic Boots of Speed.',
  'items.noLog':
    'The whole-match purchase log is unavailable in the OpenDota response, so this section cannot be built.',
  'items.legacyUnavailable':
    'A report saved in the older format does not contain the whole-match purchase log; this section is unavailable without a new OpenDota request.',
  'items.hint':
    'This whole-match section shows only meaningful acquisitions: completed items, Bottle and basic Boots of Speed unless they were upgraded into completed boots (Power Treads, Phase Boots, Arcane Boots, Tranquil Boots, Boots of Travel, Boots of Travel 2, Guardian Greaves, Boots of Bearing). Components (Iron Branch, Gloves of Haste, Mithril Hammer, Magic Stick, etc.), ordinary consumables, recipes, Refresher Shard, Cheese and Block of Cheese are hidden here; the detailed purchase list for 00:00–15:00 is in the lane stage report. The boots upgrade is determined from the confirmed purchase history, not from the final inventory. The time is the first purchase of the item in the OpenDota log; if the time is not confirmed, the item is not shown.',

  // --- Наблюдения и рекомендации ---
  'analysis.observationsTitle': 'Observations',
  'analysis.notAnAssessment': 'Observation, not an assessment',
  'analysis.selectPlayer': 'Select a participant to see observations for the match data.',
  'analysis.rulesVersion': 'Analysis rules version: {version}',
  'analysis.insufficientData': 'Not enough data for a reliable assessment.',
  'analysis.recommendationsTitle': 'Recommendations',
  'analysis.recommendationsUnavailable':
    'Objective recommendations are unavailable: the project documentation does not confirm hero and role benchmarks, so comparing metrics against a reference and giving gameplay advice is not performed. The observations above describe only facts from the OpenDota response.',
  'analysis.ruleLabel': 'Rule: {ruleId}',
  'analysis.limitationsTitle': 'Analysis limitations',
  'analysis.noLimitations': 'No limitations recorded.',
  'analysis.translationUnavailable':
    'Translation unavailable: the stored text is shown as is (rule {ruleId}, version {ruleVersion}).',

  // --- Сохранение личного отчёта ---
  'persistence.title': 'Personal report',
  'persistence.stored.badge': 'Saved report',
  'persistence.stored.summary':
    'A previously saved personal report is shown: OpenDota was not requested and observations were not recalculated.',
  'persistence.saved.badge': 'New report saved',
  'persistence.saved.summary': 'The report was built and saved to your personal history.',
  'persistence.saved.summaryPartial':
    'The report was built and saved to your personal history (partial data — see the limitations below).',
  'persistence.conflict.badge': 'Saved report',
  'persistence.conflict.summary':
    'The report was already saved by another request: the existing record is shown, no second row was created and no data was overwritten.',
  'persistence.guest.badge': 'Guest mode',
  'persistence.guest.summary':
    'The report is not saved: you are not logged in. The analysis is built from OpenDota data and shown only on this page.',
  'persistence.guest.loginHint': 'Log in to keep reports in your personal history.',
  'persistence.guest.loginLink': 'Log in',
  'persistence.noDatabase.badge': 'Saving unavailable',
  'persistence.noDatabase.summary':
    'The analysis was built, but the personal history is unavailable: the database connection is not configured.',
  'persistence.failed.badge': 'Report not saved',
  'persistence.failed.summary': 'The report was built, but it could not be saved.',
  'persistence.unresolved.badge': 'Unfinished record',
  'persistence.unresolved.summary':
    'A freshly calculated report is shown: the existing record was not overwritten.',
  'persistence.partialNote':
    'Partial report: part of the provider data is unavailable — only confirmed values are stored (missing metrics remain empty).',
  'persistence.rulesVersionLabel': 'Analysis rules version:',
  'persistence.sourceLabel': 'Data source:',
  'persistence.fetchedAt': 'OpenDota data received: {value}',
  'persistence.savedAt': 'Report saved: {value}',
  'persistence.reportId': 'Report identifier: {id}',
  'persistence.limitationsTitle': 'Limitations of the stored data',
  'persistence.retry': 'Retry saving',
  'persistence.retrying': 'Saving…',
  'persistence.refreshed.badge': 'Report updated',
  'persistence.refreshed.summary':
    'The saved report was updated with confirmed replay details: only your row changed and no duplicates were created.',
  'persistence.refreshSkipped.badge': 'Saved report left unchanged',
  'persistence.refreshSkipped.notUsable':
    'The report row is not ready for an update: the saved data was not changed.',
  'persistence.refreshSkipped.storedDetailed':
    'The saved report already contains detailed data: nothing was overwritten.',
  'persistence.refreshSkipped.notDetailed':
    'Replay details could not be obtained: the previously saved report is shown.',
  'persistence.refreshSkipped.worseData':
    'The new data is less complete than the saved one: the report was left unchanged.',
  'persistence.refreshFailed.summary':
    'Detailed data was obtained, but the saved report could not be updated — the previous report is shown.',

  // --- Replay parsing (Task 14) ---
  'parse.title': 'OpenDota replay parsing',
  'parse.badge.ready': 'Analysis ready',
  'parse.badge.pending': 'Parsing still in progress',
  'parse.badge.unavailable': 'Replay unavailable',
  'parse.badge.failed': 'Parsing not completed',
  'parse.ready': 'Analysis ready: detailed replay data has been loaded.',
  'parse.pending':
    'OpenDota is still processing the replay. The request is stored: the next time you open this page, tracking resumes automatically.',
  'parse.replayUnavailable': 'Replay unavailable. Showing available statistics.',
  'parse.rateLimited': 'OpenDota rate-limited the requests. Showing available statistics.',
  'parse.networkFailed':
    'The network is unavailable or OpenDota is not responding. Showing available statistics.',
  'parse.failed': 'Detailed replay data could not be obtained. Showing available statistics.',
  'parse.incomplete':
    'The replay was parsed, but the detailed data is still incomplete. Showing available statistics.',
  'parse.hint':
    'The parsing request is sent automatically — no separate button is needed. Repeat requests are limited to avoid wasting OpenDota rate limits.',
  'persistence.rulesMismatch':
    'The report was saved with analysis rules version {stored}; the current rules version is {current}. Stored observations are shown without recalculation.',

  // --- Личная история ---
  'history.badge': 'Personal data',
  'history.title': 'Analysis history',
  'history.lead':
    'Saved reports are visible only to your account: matches you analysed are listed here and can be opened without a new OpenDota request.',
  'history.loading': 'Loading the analysis history…',
  'history.waitingAuth': 'Checking your session…',
  'history.signedOut': 'The history is available only after logging in.',
  'history.loginLink': 'Log in',
  'history.noDatabaseNote':
    'Match analysis is still available on the match page, but the saved history is unavailable without a configured connection.',
  'history.empty': 'You have no saved analyses yet.',
  'history.emptyHint': 'Open a match by ID — the report is saved automatically and appears here.',
  'history.emptyCta': 'Analyse a match',
  'history.error': 'Could not load the analysis history.',
  'history.retry': 'Retry loading',
  'history.matchTitle': 'Match {id}',
  'history.savedAtLabel': 'Saved',
  'history.resultLabel': 'Result',
  'history.sourceLabel': 'Source',
  'history.rulesLabel': 'Rules version',
  'history.rulesMissing': 'not specified',
  'history.status.ready': 'Complete report',
  'history.status.partial': 'Partial report',
  'history.status.pending': 'Awaiting analysis',
  'history.status.error': 'Analysis error',
  'history.openReport': 'Open report',
  'history.openUnavailable': 'Opening is unavailable: {status}.',
  'history.result.radiant': 'Radiant victory',
  'history.result.dire': 'Dire victory',
  'history.showMore': 'Show more',
  'history.loadingMore': 'Loading…',
  'history.incomplete':
    'Showing the latest {count} reports. Older ones can be loaded — the list is not complete.',

  // --- Прочие страницы ---
  'heroes.title': 'Heroes',
  'heroes.description':
    'The hero catalogue, win rates, picks, items and average metrics will appear later — after the data source and calculation methodology are confirmed. For now this is a design placeholder.',
  'placeholder.badge': 'Feature in development',
  'notFound.title': 'Page not found',
  'notFound.text':
    'This page does not exist — the address may be mistyped or the section is not implemented yet.',
  'notFound.home': 'Back to home',

  // --- Периоды анализа ---
  'period.match': 'whole match',
  'period.laning': '00:00–10:00',

  // --- Известные коды ограничений ---
  'limitation.player.not_in_match':
    'The selected participant was not found in the match data — the analysis was not performed.',
  'limitation.match.kda.partial':
    'K/D/A values are incomplete — no whole-match observation was produced.',
  'limitation.match.kda.missing': 'Whole-match K/D/A values are missing from the OpenDota response.',
  'limitation.laning.last_hits_at_10.missing':
    'No last hits data at minute 10: the lh_t series is missing or shorter than 11 elements.',
  'limitation.laning.last_hits_at_15.missing':
    'No last hits data at minute 15: the lh_t series is missing or shorter than 16 elements.',
  'limitation.laning.gold_at_10.missing':
    'No gold data at minute 10: the gold_t series is missing or shorter than 11 elements.',
  'limitation.laning.gold_at_15.missing':
    'No gold data at minute 15: the gold_t series is missing or shorter than 16 elements.',
  'limitation.laning.xp_at_10.missing':
    'No experience data at minute 10: the xp_t series is missing or shorter than 11 elements.',
  'limitation.laning.xp_at_15.missing':
    'No experience data at minute 15: the xp_t series is missing or shorter than 16 elements.',
  'limitation.laning.events.missing':
    'First-ten-minutes event logs (kills_log, deaths_log) are missing or unreliable.',
  'limitation.laning.events.first_15.missing':
    'First-fifteen-minutes event logs (kills_log, deaths_log) are missing or unreliable.',
  'limitation.laning.events.partial':
    'Early-stage kill and death logs are only partially available — no observation was produced.',
  'limitation.laning.purchases.missing':
    'The purchase log is unavailable — the number of first-ten-minutes purchases is undetermined.',
  'limitation.laning.purchases_first_15.missing':
    'The purchase log is unavailable — the number of first-fifteen-minutes purchases is undetermined.',
  'limitation.laning.efficiency_pct.missing':
    'Lane efficiency (lane_efficiency_pct) is missing from the OpenDota response.',
  'limitation.benchmarks.hero_role_missing':
    'Hero and role benchmarks are not confirmed: comparison with other players, lane quality grading and recommendations are not performed.',
  'limitation.match.id.missing':
    'The OpenDota response contains no match ID: the data is confirmed only by the requested address.',
  'limitation.match.id.mismatch':
    'The match ID in the OpenDota response does not match the requested one.',
  'limitation.match.duration.missing':
    'The match duration is missing or invalid in the OpenDota response.',
  'limitation.match.winner.missing': 'The match winner is not specified in the OpenDota response.',
  'limitation.players.empty':
    'The OpenDota response contains no participant with a valid player_slot.',
  'limitation.players.incomplete': 'Part of the match data is unavailable: not all participants were returned.',
  'limitation.report.match_payload.missing':
    'The match data snapshot is missing: the report record is unfinished (payload not written).',
  'limitation.report.analysis_payload.missing':
    'The analysis snapshot is missing: the report record is unfinished (payload not written).',
} as const