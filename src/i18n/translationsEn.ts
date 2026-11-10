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
  'match.analysisTitle': 'Selected player analysis',
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
  'match.stats.gpmHint': 'Gold per minute',
  'match.stats.xpmHint': 'Experience per minute',
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

  // --- Match header (Task 15) ---
  'matchHeader.winnerRadiant': 'Radiant Victory',
  'matchHeader.winnerDire': 'Dire Victory',
  'matchHeader.winnerUnknown': 'Winner not confirmed',
  'matchHeader.score': 'Score',
  'matchHeader.scoreUnavailable': 'Score unavailable: participant data is insufficient.',
  'matchHeader.scoreProvider': 'Score from confirmed OpenDota fields.',
  'matchHeader.scorePlayers': 'Score computed from confirmed kills of all ten participants.',
  'matchHeader.duration': 'Duration',
  'matchHeader.matchId': 'Match ID',
  'matchHeader.gameMode': 'Game mode',
  'matchHeader.region': 'Region',
  'matchHeader.started': 'Started',
  'matchHeader.ageDays': '{days} days ago',
  'matchHeader.source': 'Source',
  'matchHeader.sourceValue': 'OpenDota',
  'matchHeader.radiantShort': 'Radiant',
  'matchHeader.direShort': 'Dire',

  // --- Team overview (Task 15) ---
  'team.radiantTitle': 'Radiant',
  'team.direTitle': 'Dire',
  'team.tableLabel': 'Team overview: {team}',
  'team.columnHero': 'Hero',
  'team.columnPlayer': 'Player',
  'team.columnLevel': 'Lvl',
  'team.columnKda': 'K / D / A',
  'team.columnLastHits': 'Last hits',
  'team.columnDenies': 'Denies',
  'team.columnNetWorth': 'Net worth',
  'team.columnGpm': 'GPM',
  'team.columnXpm': 'XPM',
  'team.columnGpmHint': 'Gold per minute',
  'team.columnXpmHint': 'Experience per minute',
  'team.columnHeroDamage': 'Hero damage',
  'team.columnTowerDamage': 'Building damage',
  'team.columnHealing': 'Healing',
  'team.columnItems': 'Items',
  'team.unknownPlayer': 'Unknown player',
  'team.heroUnknown': 'hero #{id}',
  'team.unknownHeroImage': 'Hero image unavailable',
  'team.heroImageAlt': 'Hero portrait: {hero}',
  'team.itemsUnavailable': 'Inventory unavailable',
  'team.itemAlt': 'Item: {item}',
  'team.noPlayers': 'No confirmed participants for this team.',
  'team.selectHint': 'Select a row to open the detailed analysis of that player.',
  'team.selectedMark': 'Selected',
  'team.hint':
    'Data comes from the OpenDota response; “{dash}” means the field is missing. GPM and XPM are per-minute rates, not total gold or experience.',

  // --- Ability build (Task 15) ---
  'abilities.title': 'Ability build',
  'abilities.lead': 'Order of abilities and talents learned per hero level (OpenDota record).',
  'abilities.teamTitle': 'Ability build: {team}',
  'abilities.level': 'Level {level}',
  'abilities.talent': 'Talent',
  'abilities.ability': 'Ability',
  'abilities.talentMark': 'T',
  'abilities.unknownAbility': 'Unknown ability #{id}',
  'abilities.unknownName': 'Name unavailable',
  'abilities.unavailable': 'The ability upgrade record is missing from the OpenDota response.',
  'abilities.catalogUnavailable':
    'Ability catalog unavailable: only IDs are shown, without names and icons.',
  'abilities.loading': 'Loading the ability catalog…',
  'abilities.empty': 'No abilities recorded.',
  'abilities.orderLabel': 'Order {order}',
  'abilities.heroImageAlt': 'Hero portrait: {hero}',
  'abilities.abilityImageAlt': 'Ability icon: {ability}',
  'abilities.selectHint': 'Click a player row to open that player analysis.',
  'abilities.hint':
    'Order and levels come from the OpenDota record without guessing: skipped levels are not restored and talents are marked separately.',

  // --- Buildings map (Task 15) ---
  'buildings.title': 'Buildings map',
  'buildings.lead': 'State of towers, barracks and the ancient at the end of the match.',
  'buildings.teamTitle': 'Buildings: {team}',
  'buildings.standing': 'Standing',
  'buildings.destroyed': 'Destroyed',
  'buildings.unknown': 'Unknown',
  'buildings.towerTier': 'Tier {tier} tower',
  'buildings.barracksMelee': 'Barracks (melee)',
  'buildings.barracksRanged': 'Barracks (ranged)',
  'buildings.ancient': 'Ancient',
  'buildings.laneTop': 'top',
  'buildings.laneMid': 'mid',
  'buildings.laneBot': 'bot',
  'buildings.destroyedAt': 'destroyed at {time}',
  'buildings.noTime': 'destruction time not confirmed',
  'buildings.tower4Note':
    'Both tier 4 towers share one event key: the position of a specific tower cannot be determined, so no time is attached.',
  'buildings.unavailable': 'Building state data is missing from the OpenDota response.',
  'buildings.mapLabel': 'Map schematic with building states',
  'buildings.summaryTitle': 'Text description',
  'buildings.legend': 'State: standing, destroyed, unknown.',
  'buildings.schematicNote':
    'Building coordinates come from Dota 2 map data (map entity dump, patches 7.22/7.23) and are converted to image pixels by a calibration fitted on landmark points (src/lib/buildings.ts). The owner map is shown in full, without stretching or cropping.',
  'buildings.hint':
    'State is the end-of-match state from OpenDota bitmasks; destruction time is shown only when a confirmed event exists.',
  'buildings.counters': 'Standing: {standing} · destroyed: {destroyed} · unknown: {unknown}',
  'buildings.legendTitle': 'Legend',
  'buildings.shapeLegend': 'Shape: battlemented tower — tower, roofed house — barracks, diamond — ancient.',
  'buildings.summaryTableLabel': 'Building states: {team}',
  'buildings.laneColumn': 'Lane',
  'buildings.barracksColumn': 'Barracks',
  'buildings.baseRow': 'Base',
  'buildings.mapImageAlt': 'Dota 2 map with building positions',
  'buildings.mapImageMissing':
    'The map file public/images/dotaz-map-clean.png was not found: markers are shown on a neutral background. Restore the image at that path and the map will appear automatically.',
  'buildings.mapSummaryTitle': 'Building summary',
  'buildings.mapNote':
    'Markers sit on the building positions: battlemented tower — tower, roofed house — barracks, diamond — ancient. State is the end-of-match state from confirmed OpenDota fields; the detailed lane and tier breakdown is below.',
  'buildings.legendTeams': 'Radiant — green markers, Dire — red markers.',

  // --- Shared (Task 15) ---
  'common.technicalDetails': 'Technical details',
  'enrich.loaded':
    'Visualization metadata was completed with a single read-only OpenDota request; the saved report was not modified.',
  'enrich.unavailable':
    'Building map and ability build data is unavailable: OpenDota did not return it for this match.',
  'abilities.talentsSummary': 'Talents: {count}',
  'laning.hintShort':
    'Source: OpenDota · period: {interval}. Minute values come from the OpenDota arrays and are never replaced with whole-match statistics.',
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

  // --- Task 16: first 15 minutes benchmarks ---
  'bench.title': 'First 15-Minute Benchmarks ({interval})',
  'bench.metric.lastHits': 'LH at 15:00',
  'bench.metric.gold': 'Gold at 15:00',
  'bench.metric.xp': 'XP at 15:00',
  'bench.column.metric': 'Metric',
  'bench.column.actual': 'Actual',
  'bench.column.median': 'Median',
  'bench.column.range': 'p25–p75',
  'bench.column.diff': 'Difference',
  'bench.column.sample': 'Sample',
  'bench.role.safe': 'safe lane',
  'bench.role.mid': 'mid lane',
  'bench.role.off': 'off lane',
  'bench.role.jungle': 'jungle',
  'bench.role.unknown': 'lane not determined',
  'bench.status.missingRole':
    'The player lane is not determined, so no benchmark comparison is performed.',
  'bench.status.missingPatch': 'The match patch is not confirmed: benchmarks are unavailable.',
  'bench.status.patchMismatch':
    'The match belongs to a different patch: benchmarks are available only for patch {patch}.',
  'bench.status.intervalMismatch':
    'The report covers {actual} while benchmarks cover {expected} minutes: no comparison is performed.',
  'bench.status.noBenchmark':
    'No comparable data for this hero and lane in the current patch.',
  'bench.status.insufficient': 'not enough observations',
  'bench.status.noSample': 'no observations',
  'bench.status.missingActual': 'no player data',
  'bench.status.medianOnly': 'median only (small sample)',
  'bench.meta': 'Benchmark: patch {patch}, source {source}, snapshot from {generated}.',
  'bench.limitations':
    'This is statistics, not a judgement: being above or below the median does not mean "good" or "bad". The sample is public OpenDota data; player MMR is not taken into account.',
  'bench.methodVersion':
    'Method {version}: median and quartiles (p25/p50/p75). Display thresholds: median from {medianOnly} observations, quartiles from {full}.',
  'bench.unavailable': 'Benchmarks are unavailable: the snapshot is missing or failed validation.',

  // --- Task 17: findings and recommendations ---
  'insights.title': 'Performance Insights & Recommendations',
  'insights.lead':
    'Observations for the first 15 minutes. A deviation from the median does not prove a mistake — it is a reason to review the episode.',
  'insights.severity.warning': 'Worth a look',
  'insights.severity.info': 'Observation',
  'insights.source.benchmark': 'Compared with patch {patch} benchmarks (OpenDota)',
  'insights.source.event': 'Confirmed match events (OpenDota)',
  'insights.recommendationLabel': 'Recommendation',
  'insights.empty':
    'No supported issues found: the available metrics stay within the typical range.',
  'insights.unavailable': 'Analysis is unavailable: no early-game data for the selected player.',
  'insights.noBenchmark':
    'Statistical comparisons are unavailable (benchmarks not loaded) — only confirmed events are shown.',
  'insights.hidden': 'Additional observations hidden: {count}.',
  'insights.method':
    'Recommendation rules {version}; benchmarks {benchmark}. This comparison is not a judgement of play quality.',
  'insights.sample': 'sample {sample}',
  'insights.smallSample': 'small sample — median-only comparison',
  'insights.lh.belowRange.title': 'Last hits below the typical range',
  'insights.lh.belowMedian.title': 'Last hits below the median',
  'insights.lh.aboveRange.title': 'Last hits above the typical range',
  'insights.gold.belowRange.title': 'Gold below the typical range',
  'insights.gold.belowMedian.title': 'Gold below the median',
  'insights.gold.aboveRange.title': 'Gold above the typical range',
  'insights.xp.belowRange.title': 'Experience below the typical range',
  'insights.xp.belowMedian.title': 'Experience below the median',
  'insights.xp.aboveRange.title': 'Experience above the typical range',
  'insights.metric.lastHits.description':
    'At 15:00 the player has {actual} last hits. The median for this hero and lane is {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.lastHits.recommendation':
    'Review the first 15 minutes: last-hit consistency and farming opportunities near the lane.',
  'insights.metric.gold.description':
    'At 15:00 the player has {actual} gold. The median for this hero and lane is {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.gold.recommendation':
    'Check farming efficiency and the stretches with almost no gold income.',
  'insights.metric.xp.description':
    'At 15:00 the player has {actual} experience. The median for this hero and lane is {median} (p25–p75: {p25}–{p75}); {sample}.',
  'insights.metric.xp.recommendation':
    'Look at lane presence and the time spent away from experience-generating areas.',
  'insights.farming.title': 'Farming below the typical range',
  'insights.farming.description':
    'At 15:00: {lhActual} last hits (median {lhMedian}) and {goldActual} gold (median {goldMedian}); {sample}.',
  'insights.farming.recommendation':
    'Review the first 15 minutes: last-hit consistency and periods without gold growth. These data do not establish causation.',
  'insights.deaths.warning.title': 'Multiple deaths in the first 15 minutes: {count}',
  'insights.deaths.info.title': 'A death in the first 15 minutes: {count}',
  'insights.deaths.description':
    'Confirmed event: deaths in the interval — {count}. The OpenDota data contains no causes or circumstances.',
  'insights.deaths.recommendation':
    'Review those deaths: whether they interrupted farming and experience gain.',
  'insights.kills.title': 'Kill participation: {count}',
  'insights.kills.description':
    'Confirmed kills involving the player in the first 15 minutes: {count}.',
  'insights.kills.recommendation':
    'Compare with the role task: fewer last hits and kills for a support is not a mistake.',

  // --- Task 19: hero catalog, profiles, statistics, matchups ---
  'heroes.title': 'Heroes',
  'heroes.description':
    'Full Dota 2 hero catalog: search, primary-attribute filter and profiles with verified characteristics.',
  'heroes.search.label': 'Search hero',
  'heroes.search.placeholder': 'For example, Phantom or Assassin',
  'heroes.search.clear': 'Clear search',
  'heroes.filter.legend': 'Primary attribute',
  'heroes.filter.any': 'All',
  'heroes.filter.str': 'Strength',
  'heroes.filter.agi': 'Agility',
  'heroes.filter.int': 'Intelligence',
  'heroes.filter.universal': 'Universal',
  'heroes.sort.label': 'Sorting',
  'heroes.sort.name': 'By name',
  'heroes.sort.winRate': 'By win rate',
  'heroes.sort.pickRate': 'By pick share',
  'heroes.count': 'Heroes found: {count} of {total}.',
  'heroes.empty': 'No hero matches the query and filter.',
  'heroes.emptyHint': 'Change the query or pick another attribute.',
  'heroes.loading': 'Loading hero statistics…',
  'heroes.statsUnavailable':
    'Match statistics are unavailable: the full hero catalog is shown, win rate and pick share are hidden.',
  'heroes.card.open': 'Open hero profile',
  'heroes.card.winRate': 'win rate',
  'heroes.card.pickRate': 'pick share',
  'heroes.imageFallback': 'no portrait',
  'heroes.attr.str': 'Strength',
  'heroes.attr.agi': 'Agility',
  'heroes.attr.int': 'Intelligence',
  'heroes.attr.all': 'Universal',
  'heroes.attack.Melee': 'Melee',
  'heroes.attack.Ranged': 'Ranged',

  'hero.back': 'Back to hero catalog',
  'hero.notFound.title': 'Hero not found',
  'hero.notFound.text': 'This hero is not in the verified catalog. Check the page address.',
  'hero.errors.retry': 'Retry loading',
  'hero.section.attributes': 'Characteristics',
  'hero.section.stats': 'Match statistics',
  'hero.section.matchups': 'Matchups',
  'hero.section.abilities': 'Abilities',
  'hero.section.talents': 'Talents',
  'hero.section.facets': 'Facets',
  'hero.section.items': 'Popular items',
  'hero.attributes.str': 'Strength',
  'hero.attributes.agi': 'Agility',
  'hero.attributes.int': 'Intelligence',
  'hero.attributes.all': 'Universal',
  'hero.attributes.base': 'base',
  'hero.attributes.gain': 'gain',
  'hero.attributes.damage': 'Damage',
  'hero.attributes.attackRange': 'Attack range',
  'hero.attributes.attackType': 'Attack type',
  'hero.attributes.attackRate': 'Attack rate',
  'hero.attributes.baseAttackTime': 'Base attack time',
  'hero.attributes.attackPoint': 'Attack point',
  'hero.attributes.projectileSpeed': 'Projectile speed',
  'hero.attributes.moveSpeed': 'Movement speed',
  'hero.attributes.armor': 'Armor',
  'hero.attributes.mr': 'Magic resistance',
  'hero.attributes.health': 'Health',
  'hero.attributes.mana': 'Mana',
  'hero.attributes.legs': 'Legs',
  'hero.attributes.vision': 'Vision',
  'hero.attributes.roles': 'Roles',
  'hero.attributes.snapshot':
    'OpenDota catalog snapshot dated {date}. These are reference hero characteristics, not match statistics; the provider does not report a patch.',
  'hero.attributes.unavailable': 'Characteristics are unavailable in the catalog.',

  'hero.stats.pub': 'Public matches',
  'hero.stats.turbo': 'Turbo',
  'hero.stats.pro': 'Professional',
  'hero.stats.pickShare': 'Hero pick share',
  'hero.stats.games': 'Picks: {count}',
  'hero.stats.wins': 'Wins: {count}',
  'hero.stats.bans': 'Bans: {count}',
  'hero.stats.bansMissing': 'Bans: value not reported by the provider',
  'hero.stats.pickShareNote':
    'Pick share = hero pub_pick / sum of pub_pick across all heroes in the provider sample: a share of recorded hero picks, not the share of matches featuring this hero.',
  'hero.stats.winRate': 'Win rate: {value}',
  'hero.stats.noPatch':
    'The provider reports neither patch nor observation period: this is OpenDota sample statistics, not current-patch meta.',
  'hero.stats.retrievedAt': 'Data retrieved: {time} (request time, not the observation period).',
  'hero.stats.unavailable':
    'Match statistics are unavailable: the service did not respond. Characteristics and abilities are shown from the catalog.',
  'hero.stats.empty': 'This hero has no statistics in the provider sample.',
  'hero.stats.ranks': 'Rank brackets',
  'hero.stats.rankLabel': 'Bracket {rank}',

  'hero.matchups.strongest': 'Five most successful matchups',
  'hero.matchups.weakest': 'Five least successful matchups',
  'hero.matchups.lead':
    'Win rate of the selected hero against an opponent. This is an observation, not a counterpick: causality is not determined by these data.',
  'hero.matchups.minGames': 'Only pairs with at least {count} matches are ranked.',
  'hero.matchups.games': 'Matches: {count}',
  'hero.matchups.wins': 'Wins: {count}',
  'hero.matchups.winRate': 'Win rate {value}',
  'hero.matchups.loading': 'Loading matchups…',
  'hero.matchups.error': 'Matchups are unavailable: the provider did not respond.',
  'hero.matchups.empty': 'The provider response contains no matchups for this hero.',
  'hero.matchups.insufficient':
    'No pair passes the {count}-match threshold: no ranking is built, so noise is not presented as a result.',
  'hero.matchups.limited':
    'Fewer than ten qualifying pairs: the groups never overlap, so one of them is shorter than five.',
  'hero.matchups.source':
    'Source: OpenDota /heroes/{hero}/matchups. The provider specifies neither patch, bracket, game mode nor observation period.',
  'hero.matchups.open': 'Open opponent profile',
  'hero.matchups.noSample': 'no pairs with a sufficient sample',

  'hero.abilities.loading': 'Loading abilities…',
  'hero.abilities.error': 'The ability catalog is unavailable: the provider did not respond.',
  'hero.abilities.empty': 'The provider returned no abilities for this hero.',
  'hero.abilities.type': 'Type',
  'hero.abilities.damage': 'Damage',
  'hero.abilities.target': 'Target',
  'hero.abilities.immune': 'Pierces immunity',
  'hero.abilities.dispellable': 'Dispellable',
  'hero.abilities.noDescription': 'Description is unavailable in the source.',
  'hero.abilities.descriptionFallback':
    'A Russian translation of this description is not available yet — the source text is shown.',
  'hero.abilities.missingDescriptions':
    'For some abilities ({count}) the provider returned no description — a source state, not a calculation error.',
  'hero.abilities.values': 'Values',
  'hero.abilities.innate': 'Innate',
  'hero.abilities.innateCount': 'Innate abilities in the catalog: {count}.',
  'hero.abilities.standardTitle': 'Standard abilities',
  'hero.abilities.innateTitle': 'Innate abilities',
  'hero.abilities.coverage':
    'Abilities in the catalog: {total}; with a description: {described}; without a description: {missing}.',
  'hero.abilities.additionalNote':
    'The provider only flags innate abilities; it does not mark "additional" ones, so sub-abilities and abilities in non-standard slots stay in the standard group without an invented category.',
  'hero.abilities.noDisplayName': 'technical name',
  'hero.abilities.missingNames':
    'For some abilities ({count}) the provider returned no display name — the technical catalog name is shown.',
  'hero.abilities.descriptionLanguage':
    'Ability descriptions are shown in the source language (English); game mechanics are never translated by guesswork.',

  'hero.talents.level': 'Level {level}',
  'hero.talents.empty': 'The catalog contains no talents.',
  'hero.talents.noName': 'name unavailable',

  'hero.facets.empty': 'The catalog contains no active facets.',
  'hero.facets.noDescription': 'The facet description is unavailable in the source.',
  'hero.facets.missingDescriptions':
    'For some active facets ({count}) the provider returned no description — a source state.',
  'hero.facets.deprecated':
    'Deprecated provider facets are hidden so stale data is not presented as current.',

  'hero.items.phase.start': 'Starting items',
  'hero.items.phase.early': 'Early game',
  'hero.items.phase.mid': 'Mid game',
  'hero.items.phase.late': 'Late game',
  'hero.items.count': 'Occurrences: {count}',
  'hero.items.note':
    'Occurrence counters from the OpenDota sample: the provider publishes no denominator, so no percentages are computed and popularity does not mean optimality.',
  'hero.items.loading': 'Loading popular items…',
  'hero.items.error': 'Popular items are unavailable: the provider did not respond.',
  'hero.items.empty': 'The provider returned no popular items for this hero.',
  'hero.openProfile': 'Hero profile',
  'team.openHeroProfile': 'Open hero profile',

  // --- Task 18: item purchase timings ---

  'itemTimings.title': 'Item Purchase Timing Analysis',
  'itemTimings.lead':
    'Timeline of the selected player`s confirmed purchases. The time is the OpenDota purchase event, not the moment the item was assembled.',
  'itemTimings.noLog': 'Purchase log is unavailable: timings cannot be shown.',
  'itemTimings.empty': 'The purchase log contains no events to display.',
  'itemTimings.repeat': 'purchase #{count}',
  'itemTimings.unknown': 'item outside the catalog',
  'itemTimings.median': 'median {time}',
  'itemTimings.sample': 'sample {count}',
  'itemTimings.hiddenConsumables': 'Ordinary consumables hidden: {count}.',
  'itemTimings.hiddenRecipes': 'Recipes hidden: {count}.',
  'itemTimings.repeated': 'Items purchased more than once: {count}.',
  'itemTimings.hiddenByLimit': 'Events not shown due to the limit: {count}.',
  'itemTimings.droppedInvalid':
    'Records without a valid timestamp dropped: {count} (timestamps are never replaced with zero).',
  'itemTimings.noBenchmarks':
    'Timing comparison is unavailable: the dataset is not loaded or not confirmed. Only actual purchase times are shown.',
  'itemTimings.medianNote':
    'The comparison describes players who bought the item. The median is not an "optimal" time, and a late purchase is not a mistake.',
  'itemTimings.class.early': 'earlier than typical',
  'itemTimings.class.typical': 'within the typical range',
  'itemTimings.class.late': 'later than typical',
  'itemTimings.class.insufficient': 'not enough data',
  'itemTimings.class.noSample': 'no observations',
  'itemTimings.purchased': 'purchased {time}',
  'itemTimings.col.median': 'median',
  'itemTimings.col.range': 'range',
  'itemTimings.col.difference': 'difference',
  'itemTimings.col.sample': 'sample',
  'itemTimings.col.timing': 'timing',
  'itemTimings.insufficientSample':
    'The sample of {count} observations is below the {min} threshold: no timing class is assigned and no scale is drawn.',
  'itemTimings.rowNoBenchmark': 'No benchmark for this hero, lane and patch.',
  'itemTimings.repeatNoCompare': 'Repeated purchase: the comparison applies to the first purchase only.',
  'itemTimings.scale.aria':
    'Timing scale: purchase {actual}; median {median}; typical range {p25}–{p75}; sample of {count} observations; {position}.',
  'itemTimings.scale.legend': '◆ purchase · │ median · ▬ p25–p75',
  'itemTimings.scale.position.before': 'the purchase is earlier than the typical range',
  'itemTimings.scale.position.in': 'the purchase is inside the typical range',
  'itemTimings.scale.position.after': 'the purchase is later than the typical range',
  'itemTimings.thresholdNote':
    'The classification and the scale appear only for a sample of at least {min} observations. The threshold is a product rule, not proof of statistical significance.',
  'itemTimings.thresholds':
    'Snapshot thresholds: bucket storage {store}, percentiles {full}, classification {classify} observations.',
  'itemTimings.source': 'Source: OpenDota purchase log (purchase_log).',
  'itemTimings.method':
    'Timing method {version}; patch {patch}. Comparisons only for the same hero, lane and patch.',
} as const