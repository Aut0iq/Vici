import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import logger from '~/utils/logger'
import {
	checkUris,
	copyToFile,
	findFolder,
	folderLabel,
	isFolderGranted,
	isFolderSupported,
	listFolder,
	listSubfolders,
	prepareFolder,
	releaseFolder,
	removeFromFolder,
	storeInFolder,
} from '~/../modules/audio-route/folder'

const FOLDER_KEY = 'songCacheFolder'
const FOLDER_ROOT = 'Vici cache'
const OLD_FOLDER_KEY = 'cacheFolder'
const OLD_FOLDER_ROOT = 'Vici'
const READ_CHUNK = 100

const emptyFolder = () => ({ treeUri: null, dirUri: null, files: {} })

let folder = emptyFolder()
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

const PRUNE_LIMIT = 0.3

const pruneDownloads = async () => {
	const entries = Object.entries(downloads)
	if (!entries.length) return
	const states = await checkUris(entries.map(([, item]) => item.uri)).catch(() => null)
	if (!states) return
	const missing = entries.filter((_, index) => states[index] === 'no')
	const unknown = states.filter((state) => state === 'unknown').length
	if (unknown) logger.warn('Downloads', `Could not check ${unknown} downloaded files, keeping them`)
	if (!missing.length) return
	if (missing.length > 10 && missing.length > entries.length * PRUNE_LIMIT) {
		logger.warn('Downloads', `${missing.length} of ${entries.length} downloaded files look missing, the storage may be unavailable, keeping the list`)
		return
	}
	for (const [id] of missing) delete downloads[id]
	saveDownloads()
	logger.info('Downloads', `Removed ${missing.length} songs whose files were deleted`)
}

export const registerDownload = (song, uri) => {
	if (!song?.id || !uri) return
	downloads[song.id] = { uri, song }
	saveDownloads()
}

export const registerDownloads = (entries) => {
	let added = 0
	for (const [song, uri] of entries) {
		if (!song?.id || !uri || downloads[song.id]) continue
		downloads[song.id] = { uri, song }
		added += 1
	}
	if (added) saveDownloads()
	return added
}

const isTreeInUse = async (treeUri) => {
	const downloadFolder = await AsyncStorage.getItem('downloadFolder').catch(() => null)
	return treeUri === downloadFolder || treeUri === folder.treeUri
}

const releaseUnused = async (treeUri) => {
	if (!treeUri || await isTreeInUse(treeUri)) return
	await releaseFolder(treeUri).catch(() => { })
}

export const getDownloadUri = (songId) => downloads[songId]?.uri || null

export const getDownloadedSongs = async () => Object.values(downloads).map((item) => item.song)

export const downloadedCount = (albumId) => Object.values(downloads)
	.filter((item) => (item.song?.albumId || item.song?.parent) === albumId)
	.length

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
	if (folder.dirUri) {
		const file = folder.files[name]
		return [
			{ title: 'File', value: name },
			{ title: 'Is cached', value: file ? 'Yes' : 'No' },
			{ title: 'Size', value: `${((file?.size || 0) / (1024 * 1024)).toFixed(2)} MB` },
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
		if (folder.dirUri) {
			const file = folder.files[name]
			if (file) await removeFromFolder(file.uri)
			delete folder.files[name]
		} else {
			await FileSystem.deleteAsync(`${getPathDir()}${name}`, { idempotent: true })
		}
		global.listCacheSong = (global.listCacheSong || []).filter(file => file !== name)
	} catch (error) {
		logger.warn('deleteSongCache', `${songId}: ${error?.message || error}`)
	}
}

export const getListCacheSong = async () => {
	if (folder.dirUri) return Object.keys(folder.files)
	return await FileSystem.readDirectoryAsync(getPathDir())
		.catch(() => [])
}

export const getPathSong = (songId, streamFormat) => {
	const name = songName(songId, streamFormat)
	if (isInCache(songId, streamFormat)) {
		if (folder.dirUri) return folder.files[name]?.uri || null
		return `${getPathDir()}${name}`
	}
	if (downloads[songId]) return downloads[songId].uri
	return folder.dirUri ? null : `${getPathDir()}${name}`
}

export const getTempPath = (songId, streamFormat) => {
	return `${getTempDir()}${songName(songId, streamFormat)}.part`
}

export const storeSong = async (tempUri, songId, streamFormat) => {
	const name = songName(songId, streamFormat)
	if (folder.dirUri) {
		const target = folder
		try {
			const size = await FileSystem.getInfoAsync(tempUri).then((info) => info.size || 0).catch(() => 0)
			const uri = await storeInFolder(tempUri, target.dirUri, name)
			target.files[name] = { uri, size }
		} finally {
			await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => { })
		}
	} else {
		await FileSystem.moveAsync({ from: tempUri, to: `${getPathDir()}${name}` })
	}
	if (!global.listCacheSong.includes(name)) global.listCacheSong.push(name)
	return getPathSong(songId, streamFormat)
}

const openFolder = async (treeUri) => {
	if (!await isFolderGranted(treeUri)) throw new Error('No access to the folder')
	const dirUri = await prepareFolder(treeUri, [FOLDER_ROOT, global.config.folderCache], true)
	const files = {}
	for (const file of await listFolder(dirUri)) files[file.name] = { uri: file.uri, size: file.size }
	return { treeUri, dirUri, files }
}

export const isCacheFolderSupported = isFolderSupported

export const pickCacheFolder = async () => {
	const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
	return result?.granted ? result.directoryUri : null
}

export const getCacheFolder = async () => {
	const treeUri = await AsyncStorage.getItem(FOLDER_KEY).catch(() => null)
	if (!treeUri) return null
	const label = await folderLabel(treeUri).catch(() => null)
	return {
		treeUri,
		isPrimary: label?.isPrimary ?? true,
		path: [label?.path, FOLDER_ROOT].filter(Boolean).join('/'),
		isAvailable: folder.treeUri === treeUri,
	}
}

export const changeCacheFolder = async (treeUri, move, onProgress = () => { }) => {
	const source = folder
	const target = treeUri ? await openFolder(treeUri) : emptyFolder()
	const isSamePlace = source.dirUri ? source.dirUri === target.dirUri : !target.dirUri
	const names = move && !isSamePlace ? [...(global.listCacheSong || [])] : []
	const progress = { done: 0, failed: 0, total: names.length }
	onProgress(progress)

	for (const name of names) {
		const from = source.dirUri ? source.files[name]?.uri : `${getPathDir()}${name}`
		try {
			if (!from) throw new Error('File not found')
			if (target.dirUri) {
				const size = source.files[name]?.size
					?? await FileSystem.getInfoAsync(from).then((info) => info.size || 0).catch(() => 0)
				target.files[name] = { uri: await storeInFolder(from, target.dirUri, name), size }
			} else {
				await copyToFile(from, `${getPathDir()}${name}`)
			}
			if (source.dirUri) await removeFromFolder(from)
			else await FileSystem.deleteAsync(from, { idempotent: true })
			progress.done += 1
		} catch (error) {
			progress.failed += 1
			logger.warn('changeCacheFolder', `${name}: ${error?.message || error}`)
		}
		onProgress({ ...progress })
	}

	if (treeUri) await AsyncStorage.setItem(FOLDER_KEY, treeUri)
	else await AsyncStorage.removeItem(FOLDER_KEY)
	folder = target
	if (source.treeUri && source.treeUri !== treeUri) await releaseUnused(source.treeUri)
	if (!target.dirUri) await FileSystem.makeDirectoryAsync(getPathDir(), { intermediates: true }).catch(() => { })
	global.listCacheSong = await getListCacheSong() || []
	return progress
}

const moveOldFolderBack = async () => {
	const treeUri = await AsyncStorage.getItem(OLD_FOLDER_KEY).catch(() => null)
	if (!treeUri) return
	try {
		if (await isFolderGranted(treeUri)) {
			const dirUri = await findFolder(treeUri, [OLD_FOLDER_ROOT, global.config.folderCache])
			if (dirUri) {
				let moved = 0
				for (const file of await listFolder(dirUri)) {
					try {
						if (folder.dirUri) folder.files[file.name] = { uri: await storeInFolder(file.uri, folder.dirUri, file.name), size: file.size }
						else await copyToFile(file.uri, `${getPathDir()}${file.name}`)
						await removeFromFolder(file.uri)
						if (!global.listCacheSong.includes(file.name)) global.listCacheSong.push(file.name)
						moved += 1
					} catch (error) {
						logger.warn('initCacheSong', `${file.name} not moved: ${error?.message || error}`)
					}
				}
				await removeFromFolder(dirUri)
				logger.info('initCacheSong', `Moved ${moved} cached songs from the old song folder`)
			}
			await releaseUnused(treeUri)
		}
		await AsyncStorage.removeItem(OLD_FOLDER_KEY)
	} catch (error) {
		logger.warn('initCacheSong', `Old song folder not moved: ${error?.message || error}`)
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

	folder = emptyFolder()
	const treeUri = await AsyncStorage.getItem(FOLDER_KEY).catch(() => null)
	if (treeUri) {
		folder = await openFolder(treeUri).catch((error) => {
			logger.error('initCacheSong', `Cache folder is not available, using app storage: ${error?.message || error}`)
			return emptyFolder()
		})
	}
	global.listCacheSong = await getListCacheSong() || []
	await moveOldFolderBack()
	await pruneDownloads()
}

const ALIASES_KEY = 'serverAliases'
const SAMPLE_SIZE = 3

let aliases = { map: {}, checked: {} }

export const loadServerAliases = async () => {
	try {
		const saved = JSON.parse(await AsyncStorage.getItem(ALIASES_KEY)) || {}
		aliases = { map: saved.map || {}, checked: saved.checked || {} }
	} catch {
		aliases = { map: {}, checked: {} }
	}
	return aliases
}

export const getServerAliases = () => aliases

export const saveServerAliases = async (value) => {
	aliases = value
	await AsyncStorage.setItem(ALIASES_KEY, JSON.stringify(value))
}

export const resolveFolderCache = (name) => aliases.map[name] || name

const cacheRoot = () => `${FileSystem.documentDirectory}/cache/`

const songIdOf = (name) => name.split('.')[0]

export const listAddressData = async () => {
	const result = {}
	const add = (name, ids) => {
		const entry = result[name] || (result[name] = { ids: [], count: 0 })
		entry.count += ids.length
		for (const id of ids) if (entry.ids.length < SAMPLE_SIZE && !entry.ids.includes(id)) entry.ids.push(id)
	}
	const keys = await AsyncStorage.getAllKeys().catch(() => [])
	for (const key of keys.filter((item) => item.startsWith('downloads.'))) {
		const saved = await AsyncStorage.getItem(key).then((value) => JSON.parse(value) || {}).catch(() => ({}))
		add(key.slice('downloads.'.length), Object.keys(saved))
	}
	for (const name of await FileSystem.readDirectoryAsync(cacheRoot()).catch(() => [])) {
		const files = await FileSystem.readDirectoryAsync(`${cacheRoot()}${name}/songs/`).catch(() => [])
		add(name, files.filter((file) => !file.endsWith('.part')).map(songIdOf))
	}
	if (folder.treeUri) {
		const rootUri = await findFolder(folder.treeUri, [FOLDER_ROOT]).catch(() => null)
		for (const dir of rootUri ? await listSubfolders(rootUri).catch(() => []) : []) {
			const files = await listFolder(dir.uri).catch(() => [])
			add(dir.name, files.map((file) => songIdOf(file.name)))
		}
	}
	return result
}

const mergeJsonKey = async (fromKey, toKey) => {
	const from = await AsyncStorage.getItem(fromKey).then((value) => JSON.parse(value)).catch(() => null)
	if (!from) return
	const to = await AsyncStorage.getItem(toKey).then((value) => JSON.parse(value) || {}).catch(() => ({}))
	await AsyncStorage.setItem(toKey, JSON.stringify({ ...from, ...to }))
	await AsyncStorage.removeItem(fromKey)
}

export const moveAddressData = async (fromName, toName) => {
	await mergeJsonKey(`downloads.${fromName}`, `downloads.${toName}`)
	await mergeJsonKey(`offline.albums.${fromName}`, `offline.albums.${toName}`)

	const fromDir = `${cacheRoot()}${fromName}/songs/`
	const toDir = `${cacheRoot()}${toName}/songs/`
	const files = await FileSystem.readDirectoryAsync(fromDir).catch(() => [])
	if (files.length) await FileSystem.makeDirectoryAsync(toDir, { intermediates: true }).catch(() => { })
	for (const file of files) {
		await FileSystem.moveAsync({ from: `${fromDir}${file}`, to: `${toDir}${file}` })
			.catch((error) => logger.warn('moveAddressData', `${file}: ${error?.message || error}`))
	}
	await FileSystem.deleteAsync(`${cacheRoot()}${fromName}`, { idempotent: true }).catch(() => { })

	if (folder.treeUri) {
		const fromUri = await findFolder(folder.treeUri, [FOLDER_ROOT, fromName]).catch(() => null)
		if (fromUri) {
			const toUri = await prepareFolder(folder.treeUri, [FOLDER_ROOT, toName], true)
			for (const file of await listFolder(fromUri).catch(() => [])) {
				await storeInFolder(file.uri, toUri, file.name)
					.then(() => removeFromFolder(file.uri))
					.catch((error) => logger.warn('moveAddressData', `${file.name}: ${error?.message || error}`))
			}
			await removeFromFolder(fromUri)
		}
	}
}

export const clearCache = async () => {
	await AsyncStorage.multiRemove(
		await AsyncStorage.getAllKeys()
			.then(keys => keys.filter(key => key.startsWith('http')))
			.catch(() => [])
	)
}

export const clearSongCache = async () => {
	if (folder.dirUri) {
		for (const file of Object.values(folder.files)) await removeFromFolder(file.uri).catch(() => false)
	} else {
		const pathDir = getPathDir()
		await FileSystem.readDirectoryAsync(pathDir)
			.then(files => {
				const deletePromises = files.map(file => FileSystem.deleteAsync(`${pathDir}${file}`))
				return Promise.all(deletePromises)
			})
			.catch(() => [])
	}
	await initCacheSong()
}

export const getStatCache = async () => {
	const songs = await getListCacheSong().catch(() => [])
	const bytes = folder.dirUri
		? Object.values(folder.files).reduce((sum, file) => sum + (file.size || 0), 0)
		: await FileSystem.getInfoAsync(getPathDir()).then(info => info.size || 0).catch(() => 0)
	return [
		{
			name: 'Cache Api',
			count: await AsyncStorage.getAllKeys()
				.then(keys => keys.filter(key => key.startsWith('http')).length)
				.catch(() => 0)
		},
		{
			name: 'Cache Songs',
			count: songs.length
		},
		{
			name: 'Cache Songs Size',
			count: `${(bytes / (1024 * 1024)) | 0} MB`
		},
		{
			name: 'Downloaded Songs',
			count: Object.keys(downloads).length
		},
	]
}
