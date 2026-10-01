import { style, fit, width, formatTime, size, draw } from './term.js'

const TAB_IDS = ['home', 'artists', 'albums', 'playlists', 'search', 'queue']
const PAGE = 100
const MORE_THRESHOLD = 10
const SEEK_SECONDS = 10
const VOLUME_STEP = 5
const MESSAGE_MS = 3000
const MIN_COLS = 40
const MIN_ROWS = 12
const HEADER_ROWS = 3
const FOOTER_ROWS = 4

const createView = (title, load = null, more = null) => ({
	title,
	load,
	more,
	items: [],
	selected: 0,
	scroll: 0,
	state: load ? 'idle' : 'ready',
	error: null,
	done: !more,
	hint: null,
})

export class App {
	constructor({ api, player, t, server, onQuit }) {
		this.api = api
		this.player = player
		this.t = t
		this.server = server
		this.onQuit = onQuit
		this.tab = 0
		this.stacks = TAB_IDS.map(() => [])
		this.input = null
		this.help = false
		this.message = null
		this.messageTimer = null
		this.scheduled = false

		player.on('change', () => this.schedule())
		player.on('failure', (track) => this.notify(track ? `${t.failed}: ${track.title}` : t.networkError))
	}

	schedule() {
		if (this.scheduled) return
		this.scheduled = true
		setImmediate(() => {
			this.scheduled = false
			this.render()
		})
	}

	notify(text) {
		this.message = text
		clearTimeout(this.messageTimer)
		this.messageTimer = setTimeout(() => {
			this.message = null
			this.schedule()
		}, MESSAGE_MS)
		this.schedule()
	}

	trackItems(songs) {
		return songs.map((song, index) => ({
			label: song.title,
			sub: song.artist,
			right: formatTime(song.duration),
			track: song,
			play: () => this.player.play(songs, index),
			tracks: async () => [song],
		}))
	}

	albumItem(album, right = album.year || '') {
		return {
			label: album.name || album.title,
			sub: album.artist,
			right,
			open: () => createView(album.name || album.title, async () => this.trackItems(await this.api.album(album.id))),
			tracks: () => this.api.album(album.id),
		}
	}

	artistItem(artist, right = artist.albumCount ?? '') {
		return {
			label: artist.name,
			right,
			open: () => createView(artist.name, async () => (await this.api.artist(artist.id)).map((album) => this.albumItem(album))),
		}
	}

	albumList(title, type) {
		const page = async (offset) => (await this.api.albums(type, offset, PAGE)).map((album) => this.albumItem(album))
		return createView(title, () => page(0), page)
	}

	rootView(id) {
		const t = this.t
		if (id === 'home') {
			const view = createView(t.home)
			view.items = [
				{ label: t.randomMix, sub: t.randomMixHint, play: () => this.randomMix() },
				{ label: t.newest, open: () => this.albumList(t.newest, 'newest') },
				{ label: t.frequent, open: () => this.albumList(t.frequent, 'frequent') },
				{ label: t.recent, open: () => this.albumList(t.recent, 'recent') },
				{ label: t.randomAlbums, open: () => this.albumList(t.randomAlbums, 'random') },
				{ label: t.favorites, open: () => createView(t.favorites, async () => this.trackItems(await this.api.starred())) },
			]
			return view
		}
		if (id === 'artists') return createView(t.artists, async () => (await this.api.artists()).map((artist) => this.artistItem(artist)))
		if (id === 'albums') return this.albumList(t.albums, 'alphabeticalByName')
		if (id === 'playlists') {
			return createView(t.playlists, async () => (await this.api.playlists()).map((playlist) => ({
				label: playlist.name,
				sub: playlist.owner,
				right: playlist.songCount ?? '',
				open: () => createView(playlist.name, async () => this.trackItems(await this.api.playlist(playlist.id))),
				tracks: () => this.api.playlist(playlist.id),
			})))
		}
		if (id === 'search') {
			const view = createView(t.search)
			view.hint = t.searchHint
			return view
		}
		const view = createView(t.queue)
		view.hint = t.emptyQueue
		view.queue = true
		return view
	}

	searchView(query) {
		const t = this.t
		return createView(`${t.resultsFor} «${query}»`, async () => {
			const result = await this.api.search(query)
			return [
				...result.artists.map((artist) => this.artistItem(artist, t.artist)),
				...result.albums.map((album) => this.albumItem(album, t.album)),
				...this.trackItems(result.songs),
			]
		})
	}

	get stack() {
		const stack = this.stacks[this.tab]
		if (!stack.length) stack.push(this.rootView(TAB_IDS[this.tab]))
		return stack
	}

	get view() {
		const view = this.stack[this.stack.length - 1]
		if (view.queue) {
			view.items = this.player.queue.map((song, index) => ({
				label: song.title,
				sub: song.artist,
				right: formatTime(song.duration),
				track: song,
				current: index === this.player.index,
				play: () => this.player.jump(index),
			}))
			view.selected = Math.max(0, Math.min(view.selected, view.items.length - 1))
		}
		return view
	}

	ensure(view) {
		if (view.state !== 'idle') return
		view.state = 'loading'
		view.load()
			.then((items) => {
				view.items = items
				view.state = 'ready'
				if (view.more && items.length < PAGE) view.done = true
			})
			.catch((error) => {
				view.state = 'error'
				view.error = error.message
			})
			.finally(() => this.schedule())
	}

	loadMore(view) {
		if (view.done || view.state !== 'ready' || view.selected < view.items.length - MORE_THRESHOLD) return
		view.state = 'more'
		view.more(view.items.length)
			.then((items) => {
				view.items.push(...items)
				if (items.length < PAGE) view.done = true
			})
			.catch(() => { view.done = true })
			.finally(() => {
				view.state = 'ready'
				this.schedule()
			})
	}

	randomMix() {
		this.api.randomSongs({}, 50)
			.then((songs) => this.player.play(songs, 0, {}))
			.catch((error) => this.notify(error.message))
	}

	move(delta) {
		const view = this.view
		if (!view.items.length) return
		view.selected = Math.max(0, Math.min(view.items.length - 1, view.selected + delta))
		this.loadMore(view)
	}

	activate() {
		const view = this.view
		const item = view.items[view.selected]
		if (!item) {
			if (TAB_IDS[this.tab] === 'search') this.startSearch()
			return
		}
		if (item.play) item.play()
		else if (item.open) this.stack.push(item.open())
	}

	back() {
		if (this.stack.length > 1) this.stack.pop()
	}

	switchTab(index) {
		this.tab = (index + TAB_IDS.length) % TAB_IDS.length
		if (TAB_IDS[this.tab] === 'queue') this.view.selected = Math.max(0, this.player.index)
	}

	addSelected() {
		const item = this.view.items[this.view.selected]
		if (!item?.tracks) return
		item.tracks()
			.then((tracks) => {
				this.player.add(tracks)
				this.notify(this.t.added(tracks.length))
			})
			.catch((error) => this.notify(error.message))
	}

	removeSelected() {
		const view = this.view
		if (!view.queue || !view.items.length) return
		this.player.remove(view.selected)
	}

	startSearch() {
		this.tab = TAB_IDS.indexOf('search')
		this.input = ''
	}

	inputKey(text, key) {
		if (key.name === 'escape') this.input = null
		else if (key.name === 'return' || key.name === 'enter') {
			const query = this.input.trim()
			this.input = null
			if (query) this.stacks[this.tab] = [this.rootView('search'), this.searchView(query)]
		} else if (key.name === 'backspace') this.input = this.input.slice(0, -1)
		else if (text && !key.ctrl && !key.meta && text >= ' ') this.input += text
	}

	key(text, key) {
		if (key.ctrl && key.name === 'c') return this.onQuit()
		if (this.help) {
			this.help = false
			return this.render()
		}
		if (this.input !== null) {
			this.inputKey(text, key)
			return this.render()
		}

		const page = Math.max(1, size().rows - HEADER_ROWS - FOOTER_ROWS)
		const name = key.name

		if (name === 'up' || text === 'k') this.move(-1)
		else if (name === 'down' || text === 'j') this.move(1)
		else if (name === 'pageup') this.move(-page)
		else if (name === 'pagedown') this.move(page)
		else if (name === 'home' || text === 'g') this.move(-Infinity)
		else if (name === 'end' || text === 'G') this.move(Infinity)
		else if (name === 'return' || name === 'enter') this.activate()
		else if (name === 'backspace' || name === 'escape' || text === 'h') this.back()
		else if (name === 'tab') this.switchTab(this.tab + (key.shift ? -1 : 1))
		else if (text >= '1' && text <= String(TAB_IDS.length)) this.switchTab(Number(text) - 1)
		else if (name === 'space') this.player.toggle()
		else if (text === 'n') this.player.next()
		else if (text === 'p') this.player.previous()
		else if (name === 'left') this.player.seek(-SEEK_SECONDS)
		else if (name === 'right') this.player.seek(SEEK_SECONDS)
		else if (text === '+' || text === '=') this.player.changeVolume(VOLUME_STEP)
		else if (text === '-' || text === '_') this.player.changeVolume(-VOLUME_STEP)
		else if (text === 's') this.player.toggleShuffle()
		else if (text === 'r') this.player.cycleRepeat()
		else if (text === 'R') this.randomMix()
		else if (text === 'a') this.addSelected()
		else if (text === 'd' || name === 'delete') this.removeSelected()
		else if (text === '/') this.startSearch()
		else if (text === '?') this.help = true
		else if (text === 'q') return this.onQuit()

		this.render()
	}

	headerLines(cols) {
		const t = this.t
		const titles = TAB_IDS.map((id, index) => ` ${index + 1} ${t[id]} `)
		const brand = ' VICI '
		let line = `${style.bold}${style.gold}${brand}${style.reset}`
		let used = width(brand)
		titles.forEach((title, index) => {
			if (used + width(title) > cols) return
			line += index === this.tab ? `${style.bold}${style.gold}${title}${style.reset}` : `${style.muted}${title}${style.reset}`
			used += width(title)
		})
		const server = ` ${this.server} `
		if (used + width(server) <= cols) line += `${' '.repeat(cols - used - width(server))}${style.muted}${server}`

		let second = ''
		if (this.input !== null) {
			second = ` ${style.gold}${t.searchPrompt}${style.text}${fit(`${this.input}▏`, cols - width(t.searchPrompt) - 2)}`
		} else {
			const view = this.view
			const path = this.stack.map((item) => item.title).join(' › ')
			const count = view.items.length ? ` (${view.items.length}${view.done ? '' : '+'})` : ''
			second = ` ${style.text}${style.bold}${fit(path + count, cols - 2)}`
		}
		return [line, second, `${style.muted}${'─'.repeat(cols)}`]
	}

	listLines(cols, height) {
		const t = this.t
		const view = this.view
		this.ensure(view)

		const note = (text) => {
			const lines = [` ${style.muted}${fit(text, cols - 2)}`]
			while (lines.length < height) lines.push('')
			return lines
		}

		if (view.state === 'loading' || view.state === 'idle') return note(t.loading)
		if (view.state === 'error') return note(view.error)
		if (!view.items.length) return note(view.hint || t.empty)

		if (view.selected < view.scroll) view.scroll = view.selected
		if (view.selected >= view.scroll + height) view.scroll = view.selected - height + 1
		view.scroll = Math.max(0, Math.min(view.scroll, Math.max(0, view.items.length - height)))

		const rightSize = 9
		const subSize = cols >= 70 ? Math.floor(cols * 0.3) : 0
		const labelSize = cols - 3 - rightSize - (subSize ? subSize + 1 : 0)
		const playingId = this.player.current?.id
		const lines = []

		for (let row = 0; row < height; row++) {
			const index = view.scroll + row
			const item = view.items[index]
			if (!item) {
				lines.push('')
				continue
			}
			const selected = index === view.selected
			const playing = view.queue ? item.current : item.track && item.track.id === playingId
			const base = selected ? style.selected : ''
			const main = playing ? `${style.gold}${style.bold}` : style.text
			const marker = playing ? '▶ ' : '  '
			let line = `${base}${main} ${marker}${fit(item.label, labelSize)}${style.reset}${base}`
			if (subSize) line += `${style.muted} ${fit(item.sub || '', subSize)}`
			line += `${style.muted}${fit(String(item.right ?? ''), rightSize, 'right')}`
			lines.push(line)
		}
		return lines
	}

	helpLines(cols, height) {
		const t = this.t
		const lines = [` ${style.gold}${style.bold}${fit(t.helpTitle, cols - 2)}`, '']
		const keySize = Math.min(24, Math.floor(cols * 0.4))
		for (const [keys, text] of t.help) {
			lines.push(` ${style.gold}${fit(keys, keySize)}${style.text}${fit(text, cols - keySize - 2)}`)
		}
		while (lines.length < height) lines.push('')
		return lines.slice(0, height)
	}

	footerLines(cols) {
		const t = this.t
		const player = this.player
		const track = player.current
		const lines = [`${style.muted}${'─'.repeat(cols)}`]

		const flags = [
			player.shuffle ? '⇄' : '',
			player.repeat === 'all' ? '↻' : player.repeat === 'one' ? '↻1' : '',
			player.endless ? '∞' : '',
		].filter(Boolean).join(' ')
		const status = `${flags ? `${flags}  ` : ''}${t.volume} ${Math.round(player.volume)}% `
		const statusSize = width(status)

		if (track) {
			const icon = player.paused ? '⏸' : '▶'
			const title = track.title
			const details = [track.artist, track.album].filter(Boolean).join(' · ')
			const room = Math.max(0, cols - statusSize - 4)
			const titleSize = Math.min(width(title), room)
			const detailsSize = Math.max(0, room - titleSize - 3)
			let line = ` ${style.gold}${icon} ${style.text}${style.bold}${fit(title, titleSize)}${style.reset}`
			line += detailsSize > 3 ? `${style.muted} — ${fit(details, detailsSize)}` : ' '.repeat(Math.max(0, room - titleSize))
			line += `${style.gold}${status}`
			lines.push(line)

			const length = player.duration || track.duration || 0
			const left = formatTime(player.position)
			const right = formatTime(length)
			const barSize = Math.max(0, cols - width(left) - width(right) - 4)
			const filled = length ? Math.max(0, Math.min(barSize, Math.round(barSize * player.position / length))) : 0
			lines.push(` ${style.muted}${left} ${style.gold}${'━'.repeat(filled)}${style.muted}${'─'.repeat(barSize - filled)} ${right}`)
		} else {
			lines.push(` ${style.muted}${fit(t.nothingPlaying, Math.max(0, cols - statusSize - 2))} ${style.gold}${status}`)
			lines.push('')
		}

		lines.push(this.message
			? ` ${style.accent}${fit(this.message, cols - 2)}`
			: ` ${style.muted}${fit(t.hints, cols - 2)}`)
		return lines
	}

	render() {
		const { cols, rows } = size()
		if (cols < MIN_COLS || rows < MIN_ROWS) {
			draw([`${style.muted}${fit(this.t.tooSmall, cols)}`])
			return
		}
		const height = rows - HEADER_ROWS - FOOTER_ROWS
		draw([
			...this.headerLines(cols),
			...(this.help ? this.helpLines(cols, height) : this.listLines(cols, height)),
			...this.footerLines(cols),
		])
	}
}
