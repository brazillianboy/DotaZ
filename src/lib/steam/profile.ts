import { steamProfileUrl } from './steamId.ts'

/**
 * Публичные метаданные профиля Steam (Task 20A).
 *
 * Аватар и ник — **отображаемая информация, а не доказательство личности**.
 * Личностью считается только `SteamID64`, подтверждённый OpenID. Поэтому здесь:
 * - URL аватара пропускается через строгий allowlist хостов Steam и только https;
 * - ник очищается от управляющих символов и обрезается;
 * - отсутствие данных — нормальное состояние, а не ошибка аутентификации.
 */

/** Хосты, с которых Steam отдаёт аватары. Всё остальное отклоняется. */
export const STEAM_AVATAR_HOSTS: readonly string[] = [
  'avatars.steamstatic.com',
  'avatars.akamai.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'cdn.cloudflare.steamstatic.com',
]

export const STEAM_DISPLAY_NAME_MAX = 64

/**
 * Проверяет и нормализует URL аватара Steam.
 * Возвращает `null` для не-https, чужих хостов, javascript:/data: и мусора.
 */
export function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    return null
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') {
    return null
  }
  if (!STEAM_AVATAR_HOSTS.includes(url.hostname.toLowerCase())) {
    return null
  }
  if (url.username !== '' || url.password !== '') {
    return null
  }
  return url.toString()
}

/**
 * Очищает отображаемое имя: убирает управляющие символы, схлопывает пробелы,
 * обрезает до разумной длины. Неизменённое написание сохраняется — регистр,
 * дефисы и не-латинские символы не трогаются.
 */
export function sanitizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) {
    return null
  }
  return cleaned.slice(0, STEAM_DISPLAY_NAME_MAX)
}

export interface SteamPublicProfile {
  steamId64: string
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
}

interface RawPlayerSummary {
  steamid?: unknown
  personaname?: unknown
  avatar?: unknown
  avatarmedium?: unknown
  avatarfull?: unknown
  profileurl?: unknown
}

/**
 * Разбирает ответ `ISteamUser/GetPlayerSummaries`.
 * Любое несоответствие возвращает `null`: вызывающая сторона обязана
 * опираться на уже проверенный SteamID, а не на этот ответ.
 */
export function parsePlayerSummary(
  json: unknown,
  expectedSteamId64: string,
): SteamPublicProfile | null {
  if (typeof json !== 'object' || json === null) {
    return null
  }
  const response = (json as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) {
    return null
  }
  const players = (response as { players?: unknown }).players
  if (!Array.isArray(players) || players.length === 0) {
    return null
  }
  const first = players[0] as RawPlayerSummary | null
  if (typeof first !== 'object' || first === null) {
    return null
  }
  // Ответ обязан относиться к тому же аккаунту, который мы проверили.
  if (first.steamid !== expectedSteamId64) {
    return null
  }
  return {
    steamId64: expectedSteamId64,
    personaName: sanitizeDisplayName(first.personaname),
    avatarUrl:
      sanitizeAvatarUrl(first.avatarfull) ??
      sanitizeAvatarUrl(first.avatarmedium) ??
      sanitizeAvatarUrl(first.avatar),
    // Ссылка на профиль строится из проверенного SteamID64, а не из ответа API:
    // так её нельзя подменить полем `profileurl`.
    profileUrl: steamProfileUrl(expectedSteamId64),
  }
}

/** Профиль-заглушка, когда Steam Web API недоступен: личность всё равно известна. */
export function profileWithoutMetadata(steamId64: string): SteamPublicProfile {
  return { steamId64, personaName: null, avatarUrl: null, profileUrl: null }
}
