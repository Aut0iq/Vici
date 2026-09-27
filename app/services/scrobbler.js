import { getApi } from '~/utils/api'
import logger from '~/utils/logger'
import { scrobble as scrobbleLastFm, updateNowPlaying } from '~/utils/lastfm'

const MIN_DURATION = 30
const MAX_THRESHOLD = 240

let current = null

const thresholdMs = (duration) => {
	if (!duration || duration < MIN_DURATION) return null
	return Math.min(duration / 2, MAX_THRESHOLD) * 1000
}

const playedNow = () => {
	if (!current) return 0
	return current.playedMs + (current.playingSince ? Date.now() - current.playingSince : 0)
}

const submit = () => {
	if (!current || current.submitted) return
	const need = thresholdMs(current.duration)
	if (need === null || playedNow() < need) return
	current.submitted = true
	clearTimeout(current.timer)
	const { id, startedAt, info } = current
	getApi(global.config, 'scrobble', { id, submission: true, time: startedAt })
		.then(() => logger.info('Scrobble', `Scrobbled ${id}`))
		.catch((error) => logger.error('Scrobble', `Navidrome scrobble failed: ${error?.message || error}`))
	scrobbleLastFm(info, startedAt).catch((error) => logger.error('Scrobble', `Last.fm scrobble failed: ${error?.message || error}`))
}

const schedule = () => {
	if (!current) return
	clearTimeout(current.timer)
	const need = thresholdMs(current.duration)
	if (current.submitted || need === null || !current.playingSince) return
	current.timer = setTimeout(submit, Math.max(0, need - playedNow()) + 250)
}

const pause = () => {
	if (!current?.playingSince) return
	current.playedMs += Date.now() - current.playingSince
	current.playingSince = null
	clearTimeout(current.timer)
}

export const onTrackStart = (id, duration, isPlaying = true) => {
	if (!id) return
	const info = global.song?.songInfo?.id === id ? global.song.songInfo : null
	if (current?.id === id && !current.submitted && playedNow() < 5000) return
	if (current) {
		pause()
		submit()
		clearTimeout(current.timer)
	}
	current = {
		id,
		info: info ? { title: info.title, artist: info.artist, album: info.album, duration: info.duration } : null,
		duration: duration || global.song?.songInfo?.duration || 0,
		startedAt: Date.now(),
		playedMs: 0,
		playingSince: isPlaying ? Date.now() : null,
		submitted: false,
		timer: null,
	}
	getApi(global.config, 'scrobble', { id, submission: false }).catch(() => { })
	if (info) updateNowPlaying(info).catch(() => { })
	schedule()
}

export const onPlayingChange = (isPlaying) => {
	if (!current) return
	if (isPlaying && !current.playingSince) {
		current.playingSince = Date.now()
		schedule()
	} else if (!isPlaying) {
		pause()
		submit()
	}
}

export const onTrackEnd = (willRepeat = false) => {
	if (!current) return
	pause()
	submit()
	if (willRepeat) {
		const { id, duration } = current
		current = null
		onTrackStart(id, duration, true)
	}
}
