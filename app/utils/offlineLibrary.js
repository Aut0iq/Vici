import { getCachedSongIds, readAllJsonCache } from '~/utils/cache'
import logger from '~/utils/logger'

const SONG_KEYS = ['song', 'entry', 'child']
const DERIVED_TTL = 3000

let library = null
let loading = null
let derived = null
let generation = 0

export const resetOfflineIndex = () => {
	generation += 1
	library = null
	loading = null
	derived = null
}

const isObject = (value) => value !== null && typeof value === 'object'

const withoutChildren = (node) => {
	const rest = { ...node }
	delete rest.song
	delete rest.album
	delete rest.entry
	return rest
}

const collect = (node, key, lib) => {
	if (Array.isArray(node)) {
		for (const item of node) collect(item, key, lib)
		return
	}
	if (!isObject(node)) return
	if (node.id) {
		if (SONG_KEYS.includes(key) && !node.isDir) {
			if (!lib.songs.has(node.id)) lib.songs.set(node.id, node)
		} else if (key === 'album') {
			lib.albums.set(node.id, { ...lib.albums.get(node.id), ...withoutChildren(node) })
		} else if (key === 'artist') {
			lib.artists.set(node.id, { ...lib.artists.get(node.id), ...withoutChildren(node) })
		} else if (key === 'playlist') {
			lib.playlists.set(node.id, { ...lib.playlists.get(node.id), ...withoutChildren(node) })
			if (Array.isArray(node.entry)) lib.playlistSongs.set(node.id, node.entry.map((song) => song.id))
		}
	}
	for (const [childKey, child] of Object.entries(node)) {
		if (isObject(child)) collect(child, childKey, lib)
	}
}

const load = async () => {
	const lib = { songs: new Map(), albums: new Map(), artists: new Map(), playlists: new Map(), playlistSongs: new Map() }
	const started = Date.now()
	const responses = await readAllJsonCache().catch((error) => {
		logger.warn('Offline', `Saved responses not read: ${error?.message || error}`)
		return []
	})
	for (const json of responses) collect(json, null, lib)
	logger.info('Offline', `Library from ${responses.length} saved responses: ${lib.songs.size} songs, ${Date.now() - started} ms`)
	return lib
}

const getLibrary = () => {
	if (library) return Promise.resolve(library)
	if (!loading) {
		const job = generation
		loading = load().then((lib) => {
			if (job === generation) library = lib
			return lib
		})
	}
	return loading
}

const albumFromSong = (song, count) => ({
	id: song.albumId || song.parent,
	name: song.album,
	title: song.album,
	artist: song.albumArtist || song.artist,
	artistId: song.albumArtistId || song.artistId,
	coverArt: song.coverArt,
	year: song.year,
	genre: song.genre,
	songCount: count,
	mediaType: 'album',
})

const getDerived = async () => {
	const lib = await getLibrary()
	if (derived && derived.lib === lib && Date.now() - derived.at < DERIVED_TTL) return derived

	const cached = new Set(await getCachedSongIds().catch(() => []))
	const songs = [...lib.songs.values()].filter((song) => cached.has(song.id))
	const albumSongs = new Map()
	const artistIds = new Set()
	for (const song of songs) {
		const albumId = song.albumId || song.parent
		if (albumId) albumSongs.set(albumId, [...(albumSongs.get(albumId) || []), song])
		for (const id of [song.artistId, song.albumArtistId]) if (id) artistIds.add(id)
		for (const artist of [...(song.artists || []), ...(song.albumArtists || [])]) if (artist?.id) artistIds.add(artist.id)
	}
	const albums = [...albumSongs].map(([id, list]) => lib.albums.get(id) || albumFromSong(list[0], list.length))
	for (const album of albums) if (album.artistId) artistIds.add(album.artistId)
	const artistNames = new Map(songs.map((song) => [song.artistId, song.artist]))
	const artists = [...artistIds].map((id) => lib.artists.get(id) || { id, name: artistNames.get(id) || '', mediaType: 'artist' })
	const playlistIds = new Set(
		[...lib.playlistSongs]
			.filter(([, ids]) => ids.some((id) => cached.has(id)))
			.map(([id]) => id)
	)

	derived = { lib, at: Date.now(), cached, songs, albums, artists, albumIds: new Set(albumSongs.keys()), artistIds, playlistIds }
	return derived
}

const keep = (item, key, view) => {
	if (!isObject(item)) return true
	if (key === 'internetRadioStation') return false
	if (SONG_KEYS.includes(key)) return item.isDir ? true : view.cached.has(item.id)
	if (key === 'album') return view.albumIds.has(item.id)
	if (key === 'artist') return view.artistIds.has(item.id)
	if (key === 'playlist') return view.playlistIds.has(item.id)
	return true
}

const prune = (node, key, view) => {
	if (Array.isArray(node)) {
		const list = node.filter((item) => keep(item, key, view)).map((item) => prune(item, key, view))
		return key === 'index' ? list.filter((group) => group?.artist?.length) : list
	}
	if (!isObject(node)) return node
	const result = {}
	for (const [childKey, child] of Object.entries(node)) result[childKey] = isObject(child) ? prune(child, childKey, view) : child
	return result
}

export const filterOffline = async (json) => {
	if (!json) return json
	return prune(json, null, await getDerived())
}

const parseQuery = (query) => {
	if (!query) return {}
	if (typeof query === 'object') return query
	const params = {}
	for (const part of String(query).split('&')) {
		if (!part) continue
		const [name, ...rest] = part.split('=')
		try {
			params[decodeURIComponent(name)] = decodeURIComponent(rest.join('='))
		} catch {
			params[name] = rest.join('=')
		}
	}
	return params
}

const number = (value, fallback) => {
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? fallback : parsed
}

const shuffle = (list) => {
	const copy = [...list]
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const value = copy[i]
		copy[i] = copy[j]
		copy[j] = value
	}
	return copy
}

const text = (value) => String(value || '').toLowerCase()
const byText = (field) => (a, b) => text(field(a)).localeCompare(text(field(b)))
const byNumber = (field) => (a, b) => (field(b) || 0) - (field(a) || 0)
const byDate = (field) => (a, b) => String(field(b) || '').localeCompare(String(field(a) || ''))

const sortAlbums = (albums, params) => {
	switch (params.type) {
		case 'newest': return [...albums].sort(byDate((album) => album.created))
		case 'recent': return [...albums].filter((album) => album.played).sort(byDate((album) => album.played))
		case 'frequent': return [...albums].filter((album) => album.playCount).sort(byNumber((album) => album.playCount))
		case 'highest': return [...albums].filter((album) => album.userRating).sort(byNumber((album) => album.userRating))
		case 'starred': return albums.filter((album) => album.starred)
		case 'alphabeticalByArtist': return [...albums].sort(byText((album) => album.artist))
		case 'byYear': return [...albums].sort(byNumber((album) => album.year))
		case 'byGenre': return albums.filter((album) => text(album.genre) === text(params.genre))
		case 'random': return shuffle(albums)
		default: return [...albums].sort(byText((album) => album.name || album.title))
	}
}

const groupArtists = (artists) => {
	const groups = new Map()
	for (const artist of [...artists].sort(byText((item) => item.name))) {
		const letter = (artist.name || '#').charAt(0).toUpperCase()
		groups.set(letter, [...(groups.get(letter) || []), artist])
	}
	return [...groups].map(([name, artist]) => ({ name, artist }))
}

const page = (list, params, countKey, offsetKey, fallback) => {
	const offset = number(params[offsetKey], 0)
	return list.slice(offset, offset + number(params[countKey], fallback))
}

export const offlineResponse = async (path, query, isFallback) => {
	const params = parseQuery(query)
	if (isFallback && !['getAlbumList', 'getAlbumList2', 'getArtists', 'getStarred', 'getStarred2'].includes(path)) return null
	if (!isFallback && !['search3', 'getRandomSongs'].includes(path)) return null
	const view = await getDerived()

	switch (path) {
		case 'getRandomSongs':
			return { randomSongs: { song: shuffle(view.songs).slice(0, number(params.size, 10)) } }
		case 'search3': {
			const word = text(params.query).replace(/^"+|"+$/g, '').trim()
			const match = (...fields) => !word || fields.some((field) => text(field).includes(word))
			return {
				searchResult3: {
					artist: page(view.artists.filter((artist) => match(artist.name)), params, 'artistCount', 'artistOffset', 20),
					album: page(view.albums.filter((album) => match(album.name || album.title, album.artist)), params, 'albumCount', 'albumOffset', 20),
					song: page(view.songs.filter((song) => match(song.title, song.artist, song.album)), params, 'songCount', 'songOffset', 20),
				}
			}
		}
		case 'getAlbumList':
		case 'getAlbumList2': {
			const key = path === 'getAlbumList2' ? 'albumList2' : 'albumList'
			return { [key]: { album: page(sortAlbums(view.albums, params), params, 'size', 'offset', 10) } }
		}
		case 'getArtists':
			return { artists: { index: groupArtists(view.artists) } }
		case 'getStarred':
		case 'getStarred2': {
			const key = path === 'getStarred2' ? 'starred2' : 'starred'
			return {
				[key]: {
					artist: view.artists.filter((artist) => artist.starred),
					album: view.albums.filter((album) => album.starred),
					song: view.songs.filter((song) => song.starred),
				}
			}
		}
		default:
			return null
	}
}
