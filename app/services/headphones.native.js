import { AppRegistry } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { isIgnoringBatteryOptimizations } from '~/../modules/audio-route'
import { defaultSettings } from '~/contexts/settings'
import { defaultSong, songReducer } from '~/contexts/song'
import { initCacheSong, loadServerAliases, resolveFolderCache } from '~/utils/cache'
import logger from '~/utils/logger'
import Player, { loadSong } from '~/utils/player'
import State from '~/utils/playerState'
import { withClientName } from '~/utils/url'

const TASK = 'ViciHeadphones'
const POSITION_KEY = 'song.position'
const REPEAT_WINDOW = 3000

let lastResume = 0

const dispatch = (action) => {
	if (global.songDispatch) global.songDispatch(action)
	else songReducer(global.song, action)
}

const readJson = async (key) => {
	try {
		return JSON.parse(await AsyncStorage.getItem(key))
	} catch {
		return null
	}
}

export const savePosition = (id, position) => {
	if (!id) return
	AsyncStorage.setItem(POSITION_KEY, JSON.stringify({ id, position }))
		.catch((error) => logger.warn('Headphones', `Position not saved: ${error?.message || error}`))
}

const savedPosition = async (id) => {
	const saved = await readJson(POSITION_KEY)
	return saved?.id === id ? saved.position || 0 : 0
}

const prepare = async () => {
	if (global.song?.isInit) return true
	if (!await isIgnoringBatteryOptimizations()) {
		logger.warn('Headphones', 'Background work is not allowed, playback not started')
		return false
	}
	const [config, saved, offline] = await Promise.all([
		readJson('config'),
		readJson('settings'),
		AsyncStorage.getItem('offlineMode').catch(() => null),
	])
	if (!config?.url || !config?.query) return false
	const settings = { ...defaultSettings, ...saved }
	await loadServerAliases()
	global.config = {
		...config,
		query: withClientName(config.query),
		folderCache: resolveFolderCache(config.url.replace(/[^a-zA-Z0-9]/g, '_')),
	}
	global.offlineMode = offline === 'true'
	global.songsDownloading = []
	global.streamFormat = settings.streamFormat
	global.maxBitRate = settings.maxBitRate
	global.isSongCaching = settings.isSongCaching
	global.cacheNextSong = settings.cacheNextSong
	global.saveQueue = settings.saveQueue
	global.repeatQueue = settings.repeatQueue
	await initCacheSong().catch((error) => logger.warn('Headphones', `Cache setup failed: ${error?.message || error}`))
	global.song = { ...defaultSong }
	await Player.initPlayer((action) => songReducer(global.song, action))
	return Boolean(global.song?.isInit)
}

export const resumeOnConnect = async (reason) => {
	if (Date.now() - lastResume < REPEAT_WINDOW) return
	lastResume = Date.now()
	global.viciAutoPlayChecked = true
	try {
		if (!await prepare()) return
		const song = global.song
		if (!song?.queue?.length || song.state === State.Playing) return
		logger.info('Headphones', `Headphones connected (${reason}), resuming`)
		if (song.isSongLoad) {
			await Player.resumeSong()
			return
		}
		const position = await savedPosition(song.queue[song.index]?.id)
		await loadSong(global.config, song.queue, song.index, position)
		dispatch({ type: 'restore', song: global.song, isSongLoad: true })
	} catch (error) {
		logger.error('Headphones', `Playback not started: ${error?.message || error}`)
	}
}

export const registerHeadphones = () => {
	AppRegistry.registerHeadlessTask(TASK, () => () => resumeOnConnect('bluetooth'))
}
