import AsyncStorage from '@react-native-async-storage/async-storage'
import md5 from 'md5'

import logger from '~/utils/logger'

// Прямая отправка скробблов в Last.fm с телефона (без участия сервера Navidrome).
// Ключ и секрет приложения, а также ключ сессии хранятся только на устройстве.

const API = 'https://ws.audioscrobbler.com/2.0/'
const KEY_ACCOUNT = 'lastfm.account'
const KEY_QUEUE = 'lastfm.queue'
const KEY_STATS = 'lastfm.stats'
const MAX_QUEUE = 100

let account = null // { apiKey, secret, sessionKey, username }
let loaded = false

export const loadAccount = async () => {
	if (loaded) return account
	try {
		account = JSON.parse(await AsyncStorage.getItem(KEY_ACCOUNT))
	} catch {
		account = null
	}
	loaded = true
	return account
}

export const getAccount = () => account

const saveAccount = async (value) => {
	account = value
	loaded = true
	if (value) await AsyncStorage.setItem(KEY_ACCOUNT, JSON.stringify(value))
	else await AsyncStorage.removeItem(KEY_ACCOUNT)
}

export const isConnected = () => !!account?.sessionKey

// Подпись запроса по правилам Last.fm: md5 от всех параметров по алфавиту + секрет
const sign = (params, secret) => {
	const base = Object.keys(params)
		.filter((k) => k !== 'format' && k !== 'callback')
		.sort()
		.map((k) => `${k}${params[k]}`)
		.join('')
	return md5(base + secret)
}

const call = async (method, params, { secret = null, post = false } = {}) => {
	const all = { ...params, method, format: 'json' }
	if (secret) all.api_sig = sign(all, secret)
	const body = Object.entries(all)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')

	const res = await fetch(post ? API : `${API}?${body}`, post ? {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	} : undefined)
	const json = await res.json().catch(() => null)
	if (!json || json.error) {
		const error = new Error(json?.message || `Last.fm error ${res.status}`)
		error.code = json?.error
		throw error
	}
	return json
}

// Шаг 1: получаем токен и ссылку, по которой пользователь разрешает доступ
export const requestToken = async (apiKey, secret) => {
	const json = await call('auth.getToken', { api_key: apiKey }, { secret })
	return {
		token: json.token,
		url: `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(json.token)}`,
	}
}

// Шаг 2: обмениваем разрешённый токен на постоянный ключ сессии
export const createSession = async (apiKey, secret, token) => {
	const json = await call('auth.getSession', { api_key: apiKey, token }, { secret })
	const value = {
		apiKey,
		secret,
		sessionKey: json.session?.key,
		username: json.session?.name,
	}
	if (!value.sessionKey) throw new Error('No session key')
	await saveAccount(value)
	return value
}

export const disconnect = () => saveAccount(null)

const authParams = () => ({
	api_key: account.apiKey,
	sk: account.sessionKey,
})

// Очередь на случай, когда нет сети: отправим при следующем удачном скроббле
const readQueue = async () => {
	try {
		return JSON.parse(await AsyncStorage.getItem(KEY_QUEUE)) || []
	} catch {
		return []
	}
}
const writeQueue = (queue) => AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => { })

// Сколько треков ушло в Last.fm и когда был последний
export const getStats = async () => {
	let stats = { count: 0, lastAt: null }
	try {
		stats = { ...stats, ...JSON.parse(await AsyncStorage.getItem(KEY_STATS)) }
	} catch { }
	const queue = await readQueue()
	return { ...stats, queued: queue.length }
}

const addToStats = async (added) => {
	try {
		const stats = JSON.parse(await AsyncStorage.getItem(KEY_STATS)) || {}
		await AsyncStorage.setItem(KEY_STATS, JSON.stringify({
			count: (stats.count || 0) + added,
			lastAt: Date.now(),
		}))
	} catch { }
}

const sendScrobble = async (items) => {
	const params = { ...authParams() }
	items.forEach((item, i) => {
		params[`artist[${i}]`] = item.artist
		params[`track[${i}]`] = item.track
		params[`timestamp[${i}]`] = item.timestamp
		if (item.album) params[`album[${i}]`] = item.album
		if (item.duration) params[`duration[${i}]`] = Math.round(item.duration)
	})
	await call('track.scrobble', params, { secret: account.secret, post: true })
}

// «Сейчас слушает» в профиле Last.fm
export const updateNowPlaying = async (song) => {
	await loadAccount()
	if (!isConnected() || !song?.title || !song?.artist) return
	try {
		await call('track.updateNowPlaying', {
			...authParams(),
			artist: song.artist,
			track: song.title,
			album: song.album || '',
			duration: song.duration ? Math.round(song.duration) : '',
		}, { secret: account.secret, post: true })
	} catch (error) {
		logger.warn('LastFM', `Now playing failed: ${error.message}`)
	}
}

// Засчитать прослушивание. timestamp — время начала прослушивания в секундах
export const scrobble = async (song, timestamp) => {
	await loadAccount()
	if (!isConnected() || !song?.title || !song?.artist) return
	const item = {
		artist: song.artist,
		track: song.title,
		album: song.album || '',
		duration: song.duration || 0,
		timestamp: Math.round(timestamp / 1000),
	}
	const queue = await readQueue()
	const batch = [...queue, item]

	try {
		await sendScrobble(batch)
		await addToStats(batch.length)
		if (queue.length) await writeQueue([])
		logger.info('LastFM', `Scrobbled ${item.artist} - ${item.track}`)
	} catch (error) {
		// Ошибки сети — отложим, ошибки данных (неверная сессия и т.п.) — не копим
		if (error.code) logger.warn('LastFM', `Scrobble rejected: ${error.message}`)
		else {
			await writeQueue(batch)
			logger.warn('LastFM', `Scrobble queued (${batch.length})`)
		}
	}
}
