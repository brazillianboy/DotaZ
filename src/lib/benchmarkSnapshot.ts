import { parseBenchmarkSnapshot, type BenchmarkSnapshot } from './benchmarks'

/**
 * Загрузка снапшота нормативов (Task 16) во время выполнения.
 *
 * Файл лежит в `public/benchmarks/` и НЕ импортируется на этапе сборки: проект
 * собирается и работает без него, а отсутствие данных даёт честное состояние
 * «нормативы недоступны». Снапшот валидируется тем же парсером, что и в тестах:
 * невалидный файл превращается в `null`, частичные данные не используются.
 *
 * ВАЖНО (правовой статус): публичный JSON-эндпоинт — это тоже распространение
 * данных. Файл включается в деплой только после подтверждения условий
 * использования данных OpenDota/Valve. См. README, раздел «Нормативы первых
 * 15 минут».
 */

/** Путь снапшота относительно базового URL сборки (`BASE_URL`). */
export const BENCHMARK_SNAPSHOT_PATH = 'benchmarks/benchmarks-7.41.json'

let cache: BenchmarkSnapshot | null | undefined

/**
 * Абсолютный URL снапшота с учётом `BASE_URL`: деплой в подкаталоге
 * (например, `/dota2/`) не ломает загрузку.
 */
export function benchmarkSnapshotUrl(baseUrl: string = import.meta.env.BASE_URL ?? '/'): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}${BENCHMARK_SNAPSHOT_PATH}`
}

export interface LoadBenchmarkOptions {
  /** Подмена `fetch` для тестов; в приложении используется глобальный. */
  fetchImpl?: typeof fetch
  /** Переопределение базового URL (по умолчанию `import.meta.env.BASE_URL`). */
  baseUrl?: string
}

/**
 * Загружает и валидирует снапшот один раз (результат кешируется, включая отказ).
 * Отсутствие файла, HTTP-ошибка, таймаут или некорректный JSON не считаются
 * ошибкой приложения: возвращается `null`.
 */
export async function loadBenchmarkSnapshot(
  options: LoadBenchmarkOptions = {},
): Promise<BenchmarkSnapshot | null> {
  if (cache !== undefined) {
    return cache
  }
  const doFetch = options.fetchImpl ?? fetch
  try {
    const response = await doFetch(benchmarkSnapshotUrl(options.baseUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      // 404 при отсутствии датасета — ожидаемое штатное состояние.
      cache = null
      return cache
    }
    const payload: unknown = await response.json()
    const parsed = parseBenchmarkSnapshot(payload)
    cache = parsed.ok ? parsed.value : null
  } catch {
    // Сеть недоступна, запрос отменён или JSON не разобран.
    cache = null
  }
  return cache
}

/** Сброс кеша: используется в тестах. */
export function resetBenchmarkSnapshotCache(): void {
  cache = undefined
}

