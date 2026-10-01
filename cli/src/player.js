import { EventEmitter } from 'node:events'

const ENDLESS_BATCH = 50
const ENDLESS_THRESHOLD = 5
const SCROBBLE_SECONDS = 240
const RESTART_SECONDS = 5
const MAX_ERRORS = 3
const REPEAT_MODES = ['off', 'all', 'one']

const shuffledOrder = (length, first) => {
	const rest = []
	for (let i = 0; i < length; i++) if (i !== first) rest.push(i)
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[rest[i], rest[j]] = [rest[j], rest[i]]
	}
	return first >= 0 ? [first, ...rest] : rest
}

export class Player extends EventEmitter {
	constructor(api, mpv, volume) {
		super()
		this.api = api
		this.mpv = mpv
		this.queue = []
		this.index = -1
		this.order = []
		this.paused = false
		this.finished = false
		this.position = 0
		this.duration = 0
		this.volume = volume
		this.shuffle = false
		this.repeat = 'off'
		this.endless = null
		this.extending = false
		this.errors = 0
		this.scrobbled = false
		this.second = -1

		mpv.on('time-pos', (value) => this.onTime(value))
		mpv.on('duration', (value) => {
			if (typeof value === 'number') this.duration = value
			this.changed()
		})
		mpv.on('pause', (value) => {
			this.paused = Boolean(value)
			this.changed()
		})
		mpv.on('ended', (reason) => this.onEnded(reason))
	}

	get current() {
		return this.queue[this.index] || null
	}

	changed() {
		this.emit('change')
	}

	onTime(value) {
		if (typeof value !== 'number') return
		this.position = value
		const track = this.current
		const length = this.duration || track?.duration || 0
		if (track && !this.scrobbled && length && value >= Math.min(length / 2, SCROBBLE_SECONDS)) {
			this.scrobbled = true
			this.api.scrobble(track.id, true).catch(() => { })
		}
		const second = Math.floor(value)
		if (second !== this.second) {
			this.second = second
			this.changed()
		}
	}

	onEnded(reason) {
		if (reason === 'eof') {
			this.errors = 0
			this.next(true)
		} else if (reason === 'error') {
			this.errors += 1
			this.emit('failure', this.current)
			if (this.errors < MAX_ERRORS) this.next(true)
			else this.finish()
		}
	}

	play(queue, index = 0, endless = null) {
		if (!queue.length) return
		this.queue = [...queue]
		this.endless = endless
		this.order = this.shuffle ? shuffledOrder(this.queue.length, index) : []
		this.start(index)
	}

	start(index) {
		const track = this.queue[index]
		if (!track) return
		this.index = index
		this.position = 0
		this.second = -1
		this.duration = track.duration || 0
		this.scrobbled = false
		this.finished = false
		this.paused = false
		this.mpv.load(this.api.streamUrl(track.id))
		this.api.scrobble(track.id, false).catch(() => { })
		this.changed()
		this.extend()
	}

	finish() {
		this.finished = true
		this.paused = true
		this.position = 0
		this.mpv.stop()
		this.changed()
	}

	step(direction) {
		const length = this.queue.length
		if (!length) return -1
		if (this.shuffle && this.order.length) {
			const place = this.order.indexOf(this.index) + direction
			if (place >= 0 && place < this.order.length) return this.order[place]
			if (this.repeat !== 'all') return -1
			return this.order[(place + this.order.length) % this.order.length]
		}
		const target = this.index + direction
		if (target >= 0 && target < length) return target
		if (this.repeat !== 'all') return -1
		return (target + length) % length
	}

	remaining() {
		if (this.shuffle && this.order.length) return this.order.length - 1 - this.order.indexOf(this.index)
		return this.queue.length - 1 - this.index
	}

	next(auto = false) {
		if (auto && this.repeat === 'one') return this.start(this.index)
		const target = this.step(1)
		if (target !== -1) return this.start(target)
		if (auto) this.finish()
	}

	previous() {
		if (!this.current) return
		if (this.position > RESTART_SECONDS) {
			this.mpv.command('seek', 0, 'absolute')
			return
		}
		const target = this.step(-1)
		if (target !== -1) this.start(target)
	}

	jump(index) {
		if (index >= 0 && index < this.queue.length) this.start(index)
	}

	toggle() {
		if (!this.current) return
		if (this.finished) return this.start(this.index)
		this.mpv.setPause(!this.paused)
	}

	seek(seconds) {
		if (this.current && !this.finished) this.mpv.seek(seconds)
	}

	changeVolume(delta) {
		this.volume = Math.max(0, Math.min(100, this.volume + delta))
		this.mpv.setVolume(this.volume)
		this.emit('volume', this.volume)
		this.changed()
	}

	toggleShuffle() {
		this.shuffle = !this.shuffle
		this.order = this.shuffle ? shuffledOrder(this.queue.length, this.index) : []
		this.changed()
	}

	cycleRepeat() {
		this.repeat = REPEAT_MODES[(REPEAT_MODES.indexOf(this.repeat) + 1) % REPEAT_MODES.length]
		this.changed()
	}

	append(tracks) {
		const start = this.queue.length
		this.queue.push(...tracks)
		if (this.shuffle) this.order.push(...tracks.map((_, i) => start + i))
	}

	add(tracks) {
		if (!tracks.length) return
		const empty = !this.queue.length
		this.append(tracks)
		if (empty) this.start(0)
		else this.changed()
	}

	remove(index) {
		if (index < 0 || index >= this.queue.length) return
		const wasCurrent = index === this.index
		this.queue.splice(index, 1)
		this.order = this.order.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
		if (!this.queue.length) {
			this.index = -1
			this.endless = null
			this.finish()
			return
		}
		if (index < this.index) this.index -= 1
		if (wasCurrent) return this.start(index < this.queue.length ? index : 0)
		this.changed()
	}

	async extend() {
		if (!this.endless || this.extending || this.remaining() > ENDLESS_THRESHOLD) return
		this.extending = true
		try {
			const known = new Set(this.queue.map((track) => track.id))
			const tracks = (await this.api.randomSongs(this.endless, ENDLESS_BATCH)).filter((track) => !known.has(track.id))
			if (tracks.length && this.endless) {
				this.append(tracks)
				this.changed()
			}
		} catch {
			this.emit('failure', null)
		} finally {
			this.extending = false
		}
	}
}
