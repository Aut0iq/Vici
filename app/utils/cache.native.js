import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import logger from '~/utils/logger'
import {
	copyToFile,
	folderLabel,
	isFolderGranted,
	isFolderSupported,
	listFolder,
	prepareFolder,
	releaseFolder,
	removeFromFolder,
	storeInFolder,
} from '~/../modules/audio-route/folder'

const FOLDER_KEY = 'cacheFolder'
const FOLDER_ROOT = 'Vici'
const READ_CHUNK = 100

const emptyFolder = () => ({ treeUri: null, dirUri: null, files: {} })

let folder = emptyFolder()

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

export const getCachedSongIds = async () => {
	const suffix = `.${global.streamFormat}`
	return (global.listCacheSong || [])
		.filter((name) => name.endsWith(suffix))
		.map((name) => name.slice(0, -suffix.length))
}

export const isSongCached = async (_config, songId, streamFormat, _maxBitrate) => {
	return global.listCacheSong?.includes(songName(songId, streamFormat)) ? true : false
}

export const getSongCachedInfo = async (_config, songId, streamFormat, _maxBitrate) => {
	const name = songName(songId, streamFormat)
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

const forget = (name) => {
	global.listCacheSong = (global.listCacheSong || []).filter(file => file !== name)
}

export const deleteSongCache = async (_config, songId, streamFormat, _maxBitrate) => {
	const name = songName(songId, streamFormat)
	try {
		if (folder.dirUri) {
			const file = folder.files[name]
			if (file) await removeFromFolder(file.uri)
			delete folder.files[name]
		} else {
			await FileSystem.deleteAsync(`${getPathDir()}${name}`)
		}
		forget(name)
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
	if (folder.dirUri) return folder.files[name]?.uri || null
	return `${getPathDir()}${name}`
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
	const dirUri = await prepareFolder(treeUri, [FOLDER_ROOT, global.config.folderCache])
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

	folder = emptyFolder()
	const treeUri = await AsyncStorage.getItem(FOLDER_KEY).catch(() => null)
	if (treeUri) {
		folder = await openFolder(treeUri).catch((error) => {
			logger.error('initCacheSong', `Song folder is not available, using app storage: ${error?.message || error}`)
			return emptyFolder()
		})
	}
	global.listCacheSong = await getListCacheSong() || []
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
	if (source.treeUri && source.treeUri !== treeUri) await releaseFolder(source.treeUri).catch(() => { })

	folder = target
	if (!target.dirUri) await FileSystem.makeDirectoryAsync(getPathDir(), { intermediates: true }).catch(() => { })
	global.listCacheSong = await getListCacheSong() || []
	return progress
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
	]
}
