import React from 'react'
import { ToastAndroid } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'

import { canSaveToMusic, findSaved, listSaved, saveToFolder, saveToMusic } from '~/../modules/audio-route/library'
import { folderLabel, isFolderGranted, isFolderSupported, listTree } from '~/../modules/audio-route/folder'
import { deleteSongCache, getDownloadUri, registerDownload, registerDownloads } from '~/utils/cache'
import { urlCover, urlStream } from '~/utils/url'
import logger from '~/utils/logger'

const ROOT = 'Vici'
const FOLDER_KEY = 'downloadFolder'
const BITRATE = 320
const COVER_SIZE = 800
const MAX_NAME = 80
const HEADER_BYTES = 16
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const FORBIDDEN = /[\\/:*?"<>|]/g

const MIME = {
	mp3: 'audio/mpeg',
	flac: 'audio/flac',
	ogg: 'audio/ogg',
	opus: 'audio/ogg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	wav: 'audio/x-wav',
	wma: 'audio/x-ms-wma',
	aiff: 'audio/aiff',
}

const toast = (text) => ToastAndroid.show(text, ToastAndroid.LONG)

const clean = (text, fallback) => {
	const value = [...String(text || '')]
		.filter((char) => char.charCodeAt(0) >= 32)
		.join('')
		.replace(FORBIDDEN, '_')
		.replace(/^[.\s]+|[.\s]+$/g, '')
	return (value || fallback).slice(0, MAX_NAME).trim()
}

const decode = (base64) => {
	const bytes = []
	let buffer = 0
	let bits = 0
	for (const char of base64.replace(/=+$/, '')) {
		buffer = (buffer << 6) | BASE64.indexOf(char)
		bits += 6
		if (bits >= 8) {
			bits -= 8
			bytes.push((buffer >> bits) & 0xff)
		}
	}
	return bytes
}

const detectType = async (uri) => {
	const head = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: HEADER_BYTES })
		.then(decode)
		.catch(() => [])
	const text = String.fromCharCode(...head)
	if (text.startsWith('fLaC')) return 'flac'
	if (text.startsWith('OggS')) return 'ogg'
	if (text.startsWith('RIFF') && text.slice(8, 12) === 'WAVE') return 'wav'
	if (text.startsWith('FORM') && text.slice(8, 11) === 'AIF') return 'aiff'
	if (text.slice(4, 8) === 'ftyp') return 'm4a'
	if (text.startsWith('ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return 'mp3'
	return null
}

const header = (headers, name) => {
	const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === name)
	return key ? String(headers[key]) : ''
}

export const isDownloadFolderSupported = isFolderSupported

export const pickDownloadFolder = async () => {
	const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
	return result?.granted ? result.directoryUri : null
}

export const getDownloadFolder = async () => {
	const treeUri = await AsyncStorage.getItem(FOLDER_KEY).catch(() => null)
	if (!treeUri) return null
	const [label, isAvailable] = await Promise.all([
		folderLabel(treeUri).catch(() => null),
		isFolderGranted(treeUri).catch(() => false),
	])
	return { treeUri, isPrimary: label?.isPrimary ?? true, path: label?.path || '', isAvailable }
}

export const setDownloadFolder = async (treeUri) => {
	if (treeUri) await AsyncStorage.setItem(FOLDER_KEY, treeUri)
	else await AsyncStorage.removeItem(FOLDER_KEY)
}

const fetchAudio = async (config, song, target) => {
	const result = await FileSystem.downloadAsync(urlStream(config, song.id, 'mp3', BITRATE), target)
	const type = header(result?.headers, 'content-type')
	if (result?.status !== 200 || type.includes('json') || type.includes('xml')) {
		throw new Error(`The server did not return the file (${result?.status})`)
	}
}

const fetchCover = async (config, song, target) => {
	const url = urlCover(config, song, COVER_SIZE)
	if (!url) return null
	const result = await FileSystem.downloadAsync(url, target).catch(() => null)
	return result?.status === 200 && header(result.headers, 'content-type').startsWith('image') ? target : null
}

const tagsFor = (song, cover) => ({
	title: song.title || '',
	artist: song.artist || '',
	album: song.album || '',
	albumArtist: song.displayAlbumArtist || song.albumArtist || '',
	track: song.track ? String(song.track) : '',
	disc: song.discNumber ? String(song.discNumber) : '',
	year: song.year ? String(song.year) : '',
	genre: song.genre || '',
	cover: cover || '',
})

const placeOf = (song) => {
	const number = song.track ? `${String(song.track).padStart(2, '0')} ` : ''
	return {
		artist: clean(song.displayAlbumArtist || song.albumArtist || song.artist, 'Unknown artist'),
		album: clean(song.album, 'Unknown album'),
		base: clean(`${number}${song.title || song.id}`, song.id),
	}
}

const withoutExtension = (path) => path.replace(/\.[^./]+$/, '')

export const reindexDownloads = async (songs) => {
	const folder = await getDownloadFolder().catch(() => null)
	if (folder && !folder.isAvailable) return 0
	const files = await (folder ? listTree(folder.treeUri) : listSaved(ROOT)).catch((error) => {
		logger.warn('Downloads', `Download folder not read: ${error?.message || error}`)
		return []
	})
	if (!files.length) return 0
	const byPath = new Map(files.map((file) => [withoutExtension(file.path), file.uri]))
	const found = []
	for (const song of songs || []) {
		if (!song?.id || getDownloadUri(song.id)) continue
		const { artist, album, base } = placeOf(song)
		const uri = byPath.get(`${artist}/${album}/${base}`)
		if (uri) found.push([song, uri])
	}
	const added = registerDownloads(found)
	if (added) logger.info('Downloads', `Found ${added} songs already in the download folder`)
	return added
}

const saveSong = async (config, song, folder) => {
	const audio = `${FileSystem.cacheDirectory}vici-download-${song.id}`
	const cover = `${FileSystem.cacheDirectory}vici-cover-${song.id}`
	const { artist, album, base } = placeOf(song)
	const existing = await findSaved(folder?.treeUri || null, folder ? [artist, album] : [ROOT, artist, album], base).catch(() => null)
	if (existing) {
		registerDownload(song, existing)
		return 'exists'
	}
	try {
		await fetchAudio(config, song, audio)
		const type = await detectType(audio) || 'mp3'
		const tags = type === 'mp3' ? tagsFor(song, await fetchCover(config, song, cover)) : null
		const name = `${base}.${type}`
		const saved = folder
			? await saveToFolder(folder.treeUri, [artist, album], name, MIME[type], audio, tags)
			: await saveToMusic(audio, `${ROOT}/${artist}/${album}`, name, MIME[type], tags)
		registerDownload(song, saved.uri)
		await deleteSongCache(config, song.id, global.streamFormat, global.maxBitRate)
		return saved.status
	} finally {
		await FileSystem.deleteAsync(audio, { idempotent: true }).catch(() => { })
		await FileSystem.deleteAsync(cover, { idempotent: true }).catch(() => { })
	}
}

const NOTIFY_INTERVAL = 300

const idle = { running: false, total: 0, done: 0, saved: 0, exists: 0, failed: 0 }

let state = idle
let queue = []
let generation = 0
let notifyTimer = null
const queuedAlbums = new Set()
const listeners = new Set()

const notify = () => {
	if (notifyTimer) return
	notifyTimer = setTimeout(() => {
		notifyTimer = null
		listeners.forEach((listener) => listener())
	}, NOTIFY_INTERVAL)
}

const albumOf = (song) => song.albumId || song.parent

export const isAlbumQueued = (albumId) => queuedAlbums.has(albumId)

const summary = (t, place) => {
	if (state.total === 1) {
		if (state.failed) return t('Could not download')
		return state.exists ? t('Already downloaded') : `${t('Saved to')} ${place}`
	}
	const parts = [`${t('Saved to')} ${place}: ${state.saved}`]
	if (state.exists) parts.push(`${t('already there')}: ${state.exists}`)
	if (state.failed) parts.push(`${t('failed')}: ${state.failed}`)
	return parts.join(', ')
}

const run = async (config, folder, t, job) => {
	const place = folder ? folder.path || '/' : `Music/${ROOT}`
	while (job === generation && queue.length) {
		const song = queue.shift()
		const status = getDownloadUri(song.id)
			? 'exists'
			: await saveSong(config, song, folder).catch((error) => {
				logger.error('Download', `${song.title || song.id}: ${error?.message || error}`)
				return 'failed'
			})
		if (job !== generation) return
		state = { ...state, done: state.done + 1, [status]: state[status] + 1 }
		notify()
	}
	if (job !== generation) return
	toast(summary(t, place))
	queuedAlbums.clear()
	state = { ...state, running: false }
	notify()
}

export const downloadSongs = async (config, songs, t) => {
	const list = (songs || []).filter((song) => song?.id && /^[a-zA-Z0-9-]+$/.test(song.id))
	if (!list.length) return 0
	if (global.offlineMode) {
		toast(t('Downloading is not available offline'))
		return 0
	}
	const folder = await getDownloadFolder()
	if (folder && !folder.isAvailable) {
		toast(t('Download folder unavailable'))
		return 0
	}
	if (!folder && !await canSaveToMusic()) {
		toast(t('Saving to Music needs Android 10 or newer'))
		return 0
	}

	const queued = new Set(queue.map((song) => song.id))
	const fresh = list.filter((song) => !queued.has(song.id))
	if (!fresh.length) return 0
	fresh.forEach((song) => { if (albumOf(song)) queuedAlbums.add(albumOf(song)) })
	queue.push(...fresh)
	toast(fresh.length > 1 ? `${t('Downloading to Music')}: ${fresh.length}` : t('Downloading to Music'))
	if (state.running) {
		state = { ...state, total: state.total + fresh.length }
		notify()
		return fresh.length
	}
	generation += 1
	state = { ...idle, running: true, total: fresh.length }
	notify()
	run(config, folder, t, generation)
	return fresh.length
}

export const stopDownloads = () => {
	generation += 1
	queue = []
	queuedAlbums.clear()
	state = { ...state, running: false }
	notify()
}

export const useDownloads = () => {
	const [, refresh] = React.useReducer((count) => count + 1, 0)

	React.useEffect(() => {
		listeners.add(refresh)
		return () => listeners.delete(refresh)
	}, [])

	return state
}
