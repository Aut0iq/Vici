import crypto from 'node:crypto'

const CLIENT = 'vici-tui'
const VERSION = '1.16.1'

const encode = (params) => Object.entries(params)
	.filter(([, value]) => value !== undefined && value !== null && value !== '')
	.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
	.join('&')

export const buildQuery = (username, password) => {
	const salt = crypto.randomBytes(8).toString('hex')
	const token = crypto.createHash('md5').update(password + salt).digest('hex')
	return `u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${VERSION}&c=${CLIENT}`
}

export const normalizeUrl = (url) => {
	let value = String(url || '').trim().replace(/\/+$/, '')
	if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`
	return value
}

export class Api {
	constructor(config) {
		this.url = config.url
		this.query = config.query
	}

	link(path, params = {}) {
		const extra = encode(params)
		return `${this.url}/rest/${path}?${this.query}${extra ? `&${extra}` : ''}`
	}

	async call(path, params = {}) {
		const response = await fetch(`${this.link(path, params)}&f=json`)
		if (!response.ok) throw new Error(`HTTP ${response.status}`)
		const json = await response.json()
		const body = json['subsonic-response']
		if (!body) throw new Error('Not a Subsonic server')
		if (body.status !== 'ok') throw new Error(body.error?.message || 'Request failed')
		return body
	}

	ping() {
		return this.call('ping')
	}

	streamUrl(id) {
		return this.link('stream', { id })
	}

	async albums(type, offset = 0, size = 100) {
		const body = await this.call('getAlbumList2', { type, size, offset })
		return body.albumList2?.album || []
	}

	async album(id) {
		const body = await this.call('getAlbum', { id })
		return body.album?.song || []
	}

	async artists() {
		const body = await this.call('getArtists')
		return (body.artists?.index || []).flatMap((group) => group.artist || [])
	}

	async artist(id) {
		const body = await this.call('getArtist', { id })
		return body.artist?.album || []
	}

	async playlists() {
		const body = await this.call('getPlaylists')
		return body.playlists?.playlist || []
	}

	async playlist(id) {
		const body = await this.call('getPlaylist', { id })
		return body.playlist?.entry || []
	}

	async starred() {
		const body = await this.call('getStarred2')
		return body.starred2?.song || []
	}

	async search(query) {
		const body = await this.call('search3', { query, artistCount: 10, albumCount: 20, songCount: 50 })
		const result = body.searchResult3 || {}
		return { artists: result.artist || [], albums: result.album || [], songs: result.song || [] }
	}

	async randomSongs(params = {}, size = 50) {
		const body = await this.call('getRandomSongs', { ...params, size })
		return body.randomSongs?.song || []
	}

	scrobble(id, submission) {
		return this.call('scrobble', { id, submission })
	}
}
