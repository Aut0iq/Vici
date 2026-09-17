import AsyncStorage from '@react-native-async-storage/async-storage'

import { getApi } from '~/utils/api'
import { parseLrc } from '~/utils/lrc'

// Свой загрузчик текстов песен.
// Порядок: кэш → Navidrome (OpenSubsonic) → LRCLIB (точное совпадение) → LRCLIB (поиск с проверкой длительности).
// Результат: { synced: boolean, lines: [{ time: number|null, text }] } или null, если текста нет.

const CACHE_PREFIX = 'lyrics.v2/'
const MISS_TTL = 3 * 24 * 60 * 60 * 1000 // «не найдено» перепроверяем раз в 3 дня
const DURATION_TOLERANCE = 3 // секунд

const normalize = (s = '') => s
	.toLowerCase()
	.replace(/\s*[([][^)\]]*(remaster|live|version|edit|mix|mono|stereo|deluxe|feat|ft\.)[^)\]]*[)\]]/g, '')
	.replace(/\s+(feat\.?|ft\.?)\s+.*$/, '')
	.replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF]+/g, ' ')
	.trim()

const cleanTitle = (title = '') => title
	.replace(/\s*[([][^)\]]*(remaster|live|version|edit|mono|stereo|deluxe|feat|ft\.)[^)\]]*[)\]]/gi, '')
	.replace(/\s+-\s+(\d{4}\s+)?remaster.*$/i, '')
	.trim()

const fromPlain = (text) => {
	const lines = (text || '').split(/\r?\n/).map((t) => t.trim())
	if (!lines.some((l) => l.length)) return null
	return { synced: false, lines: lines.map((t) => ({ time: null, text: t })) }
}

const fromSynced = (lrc) => {
	const lines = parseLrc(lrc)
	return lines.length ? { synced: true, lines } : null
}

const fetchJson = async (url, signal) => {
	const res = await fetch(url, { signal, headers: { 'Lrclib-Client': 'Vici' } })
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	return res.json()
}

const query = (params) => Object.entries(params)
	.filter(([, v]) => v !== undefined && v !== null && v !== '')
	.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
	.join('&')

// 1. Текст, который хранит сам Navidrome (из тегов файла или .lrc рядом с ним)
const fromNavidrome = async (config, song) => {
	try {
		const res = await getApi(config, 'getLyricsBySongId', { id: song.id })
		const list = res?.lyricsList?.structuredLyrics || []
		const synced = list.find((l) => l.synced && l.line?.length)
		if (synced) {
			const offset = (synced.offset || 0) / 1000
			const lines = synced.line
				.map((l) => ({ time: Math.max(0, (l.start || 0) / 1000 - offset), text: l.value || '' }))
				.sort((a, b) => a.time - b.time)
			return { synced: true, lines }
		}
		const plain = list.find((l) => l.line?.length)
		if (plain) return fromPlain(plain.line.map((l) => l.value || '').join('\n'))
	} catch { }
	return null
}

// 2–3. LRCLIB: сначала точный запрос, потом поиск с проверкой исполнителя и длительности
const fromLrcLib = async (song, signal) => {
	const duration = Math.round(song.duration || 0)
	const title = cleanTitle(song.title)

	const exact = await fetchJson(`https://lrclib.net/api/get?${query({
		track_name: title,
		artist_name: song.artist,
		album_name: song.album,
		duration: duration || undefined,
	})}`, signal).catch(() => null)
	if (exact && (!duration || !exact.duration || Math.abs(exact.duration - duration) <= DURATION_TOLERANCE)) {
		const result = fromSynced(exact.syncedLyrics) || fromPlain(exact.plainLyrics)
		if (result) return result
	}

	const found = await fetchJson(`https://lrclib.net/api/search?${query({
		track_name: title,
		artist_name: song.artist,
	})}`, signal).catch(() => null)
	if (!Array.isArray(found) || !found.length) return null

	const wantTitle = normalize(title)
	const wantArtist = normalize(song.artist)
	const candidates = found
		.filter((c) => normalize(c.trackName) === wantTitle)
		.filter((c) => {
			const artist = normalize(c.artistName)
			return !wantArtist || artist.includes(wantArtist) || wantArtist.includes(artist)
		})
		.filter((c) => !duration || !c.duration || Math.abs(c.duration - duration) <= DURATION_TOLERANCE)
		.sort((a, b) => {
			if (!!b.syncedLyrics !== !!a.syncedLyrics) return b.syncedLyrics ? 1 : -1
			return Math.abs((a.duration || 0) - duration) - Math.abs((b.duration || 0) - duration)
		})

	const best = candidates[0]
	return best ? (fromSynced(best.syncedLyrics) || fromPlain(best.plainLyrics)) : null
}

export const fetchLyrics = async (config, song, { signal } = {}) => {
	if (!song?.id) return null
	const key = CACHE_PREFIX + song.id

	try {
		const cached = JSON.parse(await AsyncStorage.getItem(key))
		if (cached?.lines?.length) return cached
		if (cached?.miss && Date.now() - cached.miss < MISS_TTL) return null
	} catch { }

	const result = (await fromNavidrome(config, song)) || (await fromLrcLib(song, signal))
	if (signal?.aborted) return null

	AsyncStorage.setItem(key, JSON.stringify(result || { miss: Date.now() })).catch(() => { })
	return result
}
