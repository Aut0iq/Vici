import { ToastAndroid } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'

import { canSaveToMusic, saveToFolder, saveToMusic } from '~/../modules/audio-route/library'
import { folderLabel, isFolderGranted, isFolderSupported } from '~/../modules/audio-route/folder'
import { deleteSongCache, getDownloadUri, registerDownload } from '~/utils/cache'
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

const saveSong = async (config, song, folder) => {
	const audio = `${FileSystem.cacheDirectory}vici-download-${song.id}`
	const cover = `${FileSystem.cacheDirectory}vici-cover-${song.id}`
	try {
		await fetchAudio(config, song, audio)
		const type = await detectType(audio) || 'mp3'
		const tags = type === 'mp3' ? tagsFor(song, await fetchCover(config, song, cover)) : null
		const artist = clean(song.displayAlbumArtist || song.albumArtist || song.artist, 'Unknown artist')
		const album = clean(song.album, 'Unknown album')
		const number = song.track ? `${String(song.track).padStart(2, '0')} ` : ''
		const name = `${clean(`${number}${song.title || song.id}`, song.id)}.${type}`
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

export const downloadSongs = async (config, songs, t) => {
	const list = (songs || []).filter((song) => song?.id && /^[a-zA-Z0-9-]+$/.test(song.id))
	if (!list.length) return
	if (global.offlineMode) {
		toast(t('Downloading is not available offline'))
		return
	}
	const folder = await getDownloadFolder()
	if (folder && !folder.isAvailable) {
		toast(t('Download folder unavailable'))
		return
	}
	if (!folder && !await canSaveToMusic()) {
		toast(t('Saving to Music needs Android 10 or newer'))
		return
	}
	const place = folder ? folder.path || '/' : `Music/${ROOT}`

	toast(list.length > 1 ? `${t('Downloading to Music')}: ${list.length}` : t('Downloading to Music'))
	const count = { saved: 0, exists: 0, failed: 0 }
	for (const song of list) {
		if (getDownloadUri(song.id)) {
			count.exists += 1
			continue
		}
		await saveSong(config, song, folder)
			.then((status) => { count[status === 'exists' ? 'exists' : 'saved'] += 1 })
			.catch((error) => {
				count.failed += 1
				logger.error('Download', `${song.title || song.id}: ${error?.message || error}`)
			})
	}

	if (list.length === 1) {
		if (count.failed) toast(t('Could not download'))
		else toast(count.exists ? t('Already downloaded') : `${t('Saved to')} ${place}`)
		return
	}
	const parts = [`${t('Saved to')} ${place}: ${count.saved}`]
	if (count.exists) parts.push(`${t('already there')}: ${count.exists}`)
	if (count.failed) parts.push(`${t('failed')}: ${count.failed}`)
	toast(parts.join(', '))
}
