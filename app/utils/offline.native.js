import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'

import { getApi, getApiNetworkFirst } from '~/utils/api'
import { deleteSongCache, isAvailableOffline } from '~/utils/cache'
import { urlStream } from '~/utils/url'
import LocalPlayer from '~/utils/player/playerLocal'
import logger from '~/utils/logger'

export const isOfflineSupported = true

const PARALLEL = 2
const PAGE = 500
const NOTIFY_INTERVAL = 300

const idle = { running: false, total: 0, done: 0, failed: 0 }

let state = idle
let queue = []
let workers = 0
let generation = 0
let albums = {}
let albumsKey = null
let notifyTimer = null
const fetchedAlbums = new Set()
const listeners = new Set()

const notify = () => {
	if (notifyTimer) return
	notifyTimer = setTimeout(() => {
		notifyTimer = null
		listeners.forEach((listener) => listener())
	}, NOTIFY_INTERVAL)
}

const storageKey = () => `offline.albums.${global.config?.folderCache}`

const loadAlbums = async () => {
	const key = storageKey()
	if (albumsKey === key) return
	albumsKey = key
	try {
		albums = JSON.parse(await AsyncStorage.getItem(key)) || {}
	} catch {
		albums = {}
	}
	notify()
}

const saveAlbums = () => {
	AsyncStorage.setItem(storageKey(), JSON.stringify(albums))
		.catch((error) => logger.warn('Offline', `Album list not saved: ${error?.message || error}`))
}

const isCached = (id) => isAvailableOffline(id)

const remember = (songs) => {
	for (const song of songs) {
		const id = song.albumId || song.parent
		if (!id) continue
		const album = albums[id] || (albums[id] = { songIds: [] })
		if (!album.songIds.includes(song.id)) album.songIds.push(song.id)
	}
	saveAlbums()
}

const finish = () => {
	if (state.failed) logger.warn('Offline', `Songs not cached: ${state.failed}`)
	state = { ...state, running: false }
	notify()
}

const work = async (config) => {
	workers += 1
	while (queue.length) {
		const song = queue.shift()
		const job = generation
		const albumId = song.albumId || song.parent
		if (albumId && !fetchedAlbums.has(albumId)) {
			fetchedAlbums.add(albumId)
			getApiNetworkFirst(config, 'getAlbum', { id: albumId }).catch(() => { })
		}
		if (!isCached(song.id)) {
			await LocalPlayer.downloadSong(urlStream(config, song.id, global.streamFormat, global.maxBitRate), song.id)
				.catch(() => null)
		}
		if (job !== generation || !state.running) continue
		state = isCached(song.id)
			? { ...state, done: state.done + 1 }
			: { ...state, failed: state.failed + 1 }
		notify()
	}
	workers -= 1
	if (!workers && state.running) finish()
}

const enqueue = (config, songs) => {
	const queued = new Set(queue.map((song) => song.id))
	const pending = songs.filter((song) => !isCached(song.id) && !queued.has(song.id))
	if (!pending.length) return 0
	queue.push(...pending)
	state = state.running
		? { ...state, total: state.total + pending.length }
		: { running: true, total: pending.length, done: 0, failed: 0 }
	notify()
	for (let started = workers; started < PARALLEL; started++) work(config)
	return pending.length
}

export const cacheSongs = async (config, songs) => {
	await loadAlbums()
	remember(songs)
	return enqueue(config, songs)
}

export const cacheAlbum = async (config, album) => {
	const json = await getApiNetworkFirst(config, 'getAlbum', { id: album.id })
	const songs = json?.album?.song || []
	fetchedAlbums.add(album.id)
	return cacheSongs(config, songs.map((song) => ({ ...song, albumId: album.id })))
}

export const removeAlbum = async (config, albumId) => {
	await loadAlbums()
	const songIds = albums[albumId]?.songIds || []
	queue = queue.filter((song) => !songIds.includes(song.id))
	for (const id of songIds) await deleteSongCache(config, id, global.streamFormat, global.maxBitRate)
	delete albums[albumId]
	saveAlbums()
	notify()
}

export const stopOffline = () => {
	generation += 1
	queue = []
	state = { ...state, running: false }
	notify()
}

export const scanLibrary = async (config) => {
	const songs = []
	for (let offset = 0; ; offset += PAGE) {
		const json = await getApi(config, 'search3', { query: '""', artistCount: 0, albumCount: 0, songCount: PAGE, songOffset: offset })
		const page = json?.searchResult3?.song || []
		songs.push(...page)
		if (page.length < PAGE) break
	}
	const missing = songs.filter((song) => !isCached(song.id))
	return {
		songs,
		missing,
		bytes: missing.reduce((sum, song) => sum + (song.size || 0), 0),
		free: await FileSystem.getFreeDiskStorageAsync().catch(() => null),
	}
}

export const albumStatus = (albumId) => {
	const songIds = albums[albumId]?.songIds
	if (!songIds?.length) return null
	return { total: songIds.length, cached: songIds.filter(isCached).length }
}

export const useOffline = () => {
	const [, refresh] = React.useReducer((count) => count + 1, 0)

	React.useEffect(() => {
		listeners.add(refresh)
		loadAlbums()
		return () => listeners.delete(refresh)
	}, [])

	return state
}
