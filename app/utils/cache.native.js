import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import logger from '~/utils/logger'
import {
	copyToFile,
	existingUris,
	findFolder,
	isFolderGranted,
	listFolder,
	releaseFolder,
	removeFromFolder,
} from '~/../modules/audio-route/folder'

const OLD_FOLDER_KEY = 'cacheFolder'
const READ_CHUNK = 100

let downloads = {}

export const getCache = async (_cacheName, _key) => {
	return null
}

export const getJsonCache = async (_cacheName, key) => {
	const json = await AsyncStorage.getItem(key)
	return json ? JSON.parse(json) : null
}

export const setJsonCache = async (_cacheName, key, json) => {
	if (!json) return
	await AsyncStorage.setItem(key, JSON.stringify(json))
}

export const readAllJsonCache = async () => {
	const keys = await AsyncStorage.getAllKeys()
		.then((list) => list.filter((key) => key.startsWith('http')))
		.catch(() => [])
	const result = []
	for (let start = 0; start < keys.length; start += READ_CHUNK) {
		const pairs = await AsyncStorage.multiGet(keys.slice(start, start + READ_CHUNK)).catch(() => [])
		for (const [, value] of pairs) {
			try {
				if (value) result.push(JSON.parse(value))
			} catch {
				continue
			}
		}
	}
	return result
}

const songName = (songId, streamFormat) => `${songId}.${streamFormat}`

const getPathDir = () => {
	return `${FileSystem.documentDirectory}/cache/${global.config.folderCache}/songs/`
}

const getTempDir = () => `${FileSystem.cacheDirectory}songs-part/`

const downloadsKey = () => `downloads.${global.config?.folderCache}`

const saveDownloads = () => {
	AsyncStorage.setItem(downloadsKey(), JSON.stringify(downloads))
		.catch((error) => logger.warn('Downloads', `List not saved: ${error?.message || error}`))
}

const loadDownloads = async () => {
	try {
		downloads = JSON.parse(await AsyncStorage.getItem(downloadsKey())) || {}
	} catch {
		downloads = {}
	}
}

const pruneDownloads = async () => {
	const entries = Object.entries(downloads)
	if (!entries.length) return
	const alive = await existingUris(entries.map(([, item]) => item.uri)).catch(() => null)
	if (!alive) return
	const kept = new Set(alive)
	const missing = entries.filter(([, item]) => !kept.has(item.uri))
	if (!missing.length) return
	for (const [id] of missing) delete downloads[id]
	saveDownloads()
	logger.info('Downloads', `Removed ${missing.length} songs whose files were deleted`)
}

export const registerDownload = (song, uri) => {
	if (!song?.id || !uri) return
	downloads[song.id] = { uri, song }
	saveDownloads()
}

export const getDownloadUri = (songId) => downloads[songId]?.uri || null

export const getDownloadedSongs = async () => Object.values(downloads).map((item) => item.song)

const isInCache = (songId, streamFormat) => Boolean(global.listCacheSong?.includes(songName(songId, streamFormat)))

export const isAvailableOffline = (songId) => Boolean(downloads[songId]) || isInCache(songId, global.streamFormat)

export const getCachedSongIds = async () => {
	const suffix = `.${global.streamFormat}`
	const ids = new Set(Object.keys(downloads))
	for (const name of global.listCacheSong || []) {
		if (name.endsWith(suffix)) ids.add(name.slice(0, -suffix.length))
	}
	return [...ids]
}

export const isSongCached = async (_config, songId, streamFormat, _maxBitrate) => {
	return isInCache(songId, streamFormat) || Boolean(downloads[songId])
}

export const getSongCachedInfo = async (_config, songId, streamFormat, _maxBitrate) => {
	const name = songName(songId, streamFormat)
	if (!isInCache(songId, streamFormat) && downloads[songId]) {
		return [
			{ title: 'File', value: downloads[songId].uri },
			{ title: 'Is cached', value: 'Downloaded' },
		]
	}
	return await FileSystem.getInfoAsync(`${getPathDir()}${name}`)
		.then(info => {
			return [
				{ title: 'File', value: name },
				{ title: 'Is cached', value: info.exists ? 'Yes' : 'No' },
				{ title: 'Size', value: `${(info.size / (1024 * 1024)).toFixed(2)} MB` },
				{ title: 'Modified', value: new Date(info.modificationTime).toLocaleString() },
			]
		})
		.catch(() => null)
}

export const deleteSongCache = async (_config, songId, streamFormat, _maxBitrate) => {
	const name = songName(songId, streamFormat)
	if (!isInCache(songId, streamFormat)) return
	try {
		await FileSystem.deleteAsync(`${getPathDir()}${name}`, { idempotent: true })
		global.listCacheSong = (global.listCacheSong || []).filter(file => file !== name)
	} catch (error) {
		logger.warn('deleteSongCache', `${songId}: ${error?.message || error}`)
	}
}

export const getListCacheSong = async () => {
	return await FileSystem.readDirectoryAsync(getPathDir())
		.catch(() => [])
}

export const getPathSong = (songId, streamFormat) => {
	if (!isInCache(songId, streamFormat) && downloads[songId]) return downloads[songId].uri
	return `${getPathDir()}${songName(songId, streamFormat)}`
}

export const getTempPath = (songId, streamFormat) => {
	return `${getTempDir()}${songName(songId, streamFormat)}.part`
}

export const storeSong = async (tempUri, songId, streamFormat) => {
	const name = songName(songId, streamFormat)
	await FileSystem.moveAsync({ from: tempUri, to: `${getPathDir()}${name}` })
	if (!global.listCacheSong.includes(name)) global.listCacheSong.push(name)
	return getPathSong(songId, streamFormat)
}

const moveOldFolderBack = async () => {
	const treeUri = await AsyncStorage.getItem(OLD_FOLDER_KEY).catch(() => null)
	if (!treeUri) return
	try {
		if (await isFolderGranted(treeUri)) {
			const dirUri = await findFolder(treeUri, ['Vici', global.config.folderCache])
			if (dirUri) {
				let moved = 0
				for (const file of await listFolder(dirUri)) {
					try {
						await copyToFile(file.uri, `${getPathDir()}${file.name}`)
						await removeFromFolder(file.uri)
						if (!global.listCacheSong.includes(file.name)) global.listCacheSong.push(file.name)
						moved += 1
					} catch (error) {
						logger.warn('initCacheSong', `${file.name} not moved back: ${error?.message || error}`)
					}
				}
				await removeFromFolder(dirUri)
				logger.info('initCacheSong', `Moved ${moved} cached songs back to app storage`)
			}
			await releaseFolder(treeUri)
		}
		await AsyncStorage.removeItem(OLD_FOLDER_KEY)
	} catch (error) {
		logger.warn('initCacheSong', `Old song folder not moved back: ${error?.message || error}`)
	}
}

export const initCacheSong = async () => {
	const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}/cache/undefined/`)
	if (info.exists) {
		await FileSystem.moveAsync({
			from: `${FileSystem.documentDirectory}/cache/undefined`,
			to: `${FileSystem.documentDirectory}/cache/${global.config.folderCache}`
		})
			.catch(error => {
				logger.error('initCacheSong', error)
			})
			.then(() => logger.info('initCacheSong', 'Renamed undefined cache folder to the correct one'))
	}

	await FileSystem.makeDirectoryAsync(getPathDir(), { intermediates: true })
		.catch(error => {
			logger.error('initCacheSong', error)
		})
	await FileSystem.makeDirectoryAsync(getTempDir(), { intermediates: true }).catch(() => { })
	await loadDownloads()
	global.listCacheSong = await getListCacheSong() || []
	await moveOldFolderBack()
	await pruneDownloads()
}

export const clearCache = async () => {
	await AsyncStorage.multiRemove(
		await AsyncStorage.getAllKeys()
			.then(keys => keys.filter(key => key.startsWith('http')))
			.catch(() => [])
	)
}

export const clearSongCache = async () => {
	const pathDir = getPathDir()
	await FileSystem.readDirectoryAsync(pathDir)
		.then(files => {
			const deletePromises = files.map(file => FileSystem.deleteAsync(`${pathDir}${file}`))
			return Promise.all(deletePromises)
		})
		.catch(() => [])
	await initCacheSong()
}

export const getStatCache = async () => {
	return [
		{
			name: 'Cache Api',
			count: await AsyncStorage.getAllKeys()
				.then(keys => keys.filter(key => key.startsWith('http')).length)
				.catch(() => 0)
		},
		{
			name: 'Cache Songs',
			count: await getListCacheSong()
				.then(files => files.length)
				.catch(() => 0)
		},
		{
			name: 'Cache Songs Size',
			count: await FileSystem.getInfoAsync(getPathDir())
				.then(info => `${(info.size / (1024 * 1024)) | 0 || 0} MB`)
				.catch(() => '0 MB')
		},
		{
			name: 'Downloaded Songs',
			count: Object.keys(downloads).length
		},
	]
}
