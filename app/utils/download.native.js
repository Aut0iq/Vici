import { ToastAndroid } from 'react-native'
import * as FileSystem from 'expo-file-system'

import { canSaveToMusic, saveToMusic } from '~/../modules/audio-route/library'
import { getPathSong, isSongCached } from '~/utils/cache'
import { urlDownload, urlStream } from '~/utils/url'
import logger from '~/utils/logger'

const ROOT = 'Vici'
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

const contentType = (headers) => {
	const key = Object.keys(headers || {}).find((name) => name.toLowerCase() === 'content-type')
	return key ? String(headers[key]) : ''
}

const fetchOriginal = async (config, song) => {
	const target = `${FileSystem.cacheDirectory}vici-download-${song.id}`
	for (const url of [urlDownload(config, song.id), urlStream(config, song.id)]) {
		const result = await FileSystem.downloadAsync(url, target).catch(() => null)
		const type = contentType(result?.headers)
		if (result?.status === 200 && !type.includes('json') && !type.includes('xml')) return target
	}
	await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => { })
	throw new Error('The server did not return the file')
}

const saveSong = async (config, song) => {
	const isRawCached = global.streamFormat === 'raw' && await isSongCached(config, song.id, 'raw', 0)
	const source = isRawCached ? getPathSong(song.id, 'raw') : await fetchOriginal(config, song)
	try {
		const type = await detectType(source) || (MIME[song.suffix] ? song.suffix : 'mp3')
		const artist = clean(song.displayAlbumArtist || song.albumArtist || song.artist, 'Unknown artist')
		const album = clean(song.album, 'Unknown album')
		const number = song.track ? `${String(song.track).padStart(2, '0')} ` : ''
		const name = `${clean(`${number}${song.title || song.id}`, song.id)}.${type}`
		return await saveToMusic(source, `${ROOT}/${artist}/${album}`, name, MIME[type])
	} finally {
		if (!isRawCached) await FileSystem.deleteAsync(source, { idempotent: true }).catch(() => { })
	}
}

export const downloadSongs = async (config, songs, t) => {
	const list = (songs || []).filter((song) => song?.id && /^[a-zA-Z0-9-]+$/.test(song.id))
	if (!list.length) return
	if (!await canSaveToMusic()) {
		toast(t('Saving to Music needs Android 10 or newer'))
		return
	}

	toast(list.length > 1 ? `${t('Downloading to Music')}: ${list.length}` : t('Downloading to Music'))
	const count = { saved: 0, exists: 0, failed: 0 }
	for (const song of list) {
		await saveSong(config, song)
			.then((result) => { count[result === 'exists' ? 'exists' : 'saved'] += 1 })
			.catch((error) => {
				count.failed += 1
				logger.error('Download', `${song.title || song.id}: ${error?.message || error}`)
			})
	}

	if (list.length === 1) {
		if (count.failed) toast(t('Could not download'))
		else toast(count.exists ? t('Already in Music') : `${t('Saved to')} Music/${ROOT}`)
		return
	}
	const parts = [`${t('Saved to')} Music/${ROOT}: ${count.saved}`]
	if (count.exists) parts.push(`${t('already there')}: ${count.exists}`)
	if (count.failed) parts.push(`${t('failed')}: ${count.failed}`)
	toast(parts.join(', '))
}
