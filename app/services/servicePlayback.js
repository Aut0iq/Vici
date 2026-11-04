import TrackPlayer, { Event, State } from "react-native-track-player"

import Player from "~/utils/player"
import { downloadNextSong } from "~/utils/player"
import { songReducer } from "~/contexts/song"
import logger from "~/utils/logger"
import { onTrackStart, onPlayingChange, onTrackEnd } from "~/services/scrobbler"
import { remainingTracks } from "~/utils/tools"
import { savePosition } from "~/services/headphones"

let lockDownload = false
let shouldPlay = false
let pauseTimer = null
let focusLost = false
let subscriptions = []

const songDispatch = (action) => {
	if (global.songDispatch) global.songDispatch(action)
	else songReducer(global.song, action)
}

const STATE_NAMES = {
	[State.Paused]: 'paused',
	[State.Stopped]: 'stopped',
	[State.Ended]: 'ended',
	[State.Error]: 'error',
	[State.None]: 'idle',
}

const trackName = () => global.song?.songInfo?.title || global.song?.songInfo?.id || '?'

module.exports = async () => {
	subscriptions.forEach((subscription) => subscription.remove())
	subscriptions = []
	const on = (event, listener) => subscriptions.push(TrackPlayer.addEventListener(event, listener))

	on(Event.RemotePlay, () => Player.resumeSong())
	on(Event.RemotePause, () => {
		logger.info('Playback', `Paused from the notification, lock screen or headset: ${trackName()}`)
		Player.pauseSong()
	})
	on(Event.RemoteStop, () => logger.info('Playback', `Stop from the notification or headset: ${trackName()}`))
	on(Event.RemoteNext, () => Player.nextSong(global.config, global.song, songDispatch))
	on(Event.RemotePrevious, () => Player.previousSong(global.config, global.song, songDispatch))
	on(Event.RemoteSeek, (event) => Player.setPosition(event.position))
	on(Event.RemoteDuck, (event) => {
		clearTimeout(pauseTimer)
		pauseTimer = null
		focusLost = event.paused
		TrackPlayer.getPlaybackState()
			.then(({ state }) => {
				if (event.paused) {
					logger.info('Playback', `Audio focus lost (${event.permanent ? 'another app took the audio' : 'temporarily'}), player ${STATE_NAMES[state] || state}: ${trackName()}`)
					if (state === State.Playing) {
						if (event.permanent) {
							Player.stopSong()
							shouldPlay = false
						} else {
							TrackPlayer.setVolume(0.5)
							shouldPlay = true
							clearTimeout(pauseTimer)
							pauseTimer = setTimeout(() => {
								pauseTimer = null
								if (!focusLost) return
								logger.info('Playback', 'Paused: audio focus did not come back within 5 s')
								Player.pauseSong()
							}, 5000)
						}
					}
				}
				else if (shouldPlay) {
					clearTimeout(pauseTimer)
					pauseTimer = null
					logger.info('Playback', 'Audio focus returned, resuming')
					TrackPlayer.setVolume(1)
					Player.resumeSong()
					shouldPlay = false
				}
			})
	})
	on(Event.PlaybackQueueEnded, (_event) => {
		if (!global.song?.queue?.length) return
		onTrackEnd(global.song.actionEndOfSong === 'repeat')
		if (global.song.actionEndOfSong === 'repeat') {
			Player.setPosition(0)
			Player.resumeSong()
		} else if (!global.repeatQueue && remainingTracks(global.song) <= 0) {
			logger.info('Playback', 'Stopped: the queue has ended and repeat is off')
			Player.stopSong()
		} else Player.nextSong(global.config, global.song, songDispatch)
	})
	on(Event.PlaybackActiveTrackChanged, async (event) => {
		if (!lockDownload && global.song?.queue?.length) {
			lockDownload = true
			downloadNextSong(global.song.queue, global.song.index)
				.then(() => {
					lockDownload = false
				})
				.catch((error) => {
					lockDownload = false
					logger.error('downloadNextSong', error)
				})
		}

		if (event.track) onTrackStart(event.track.id, event.track.duration)
	})
	let lastState = null
	on(Event.PlaybackState, ({ state }) => {
		onPlayingChange(state === State.Playing)
		if (STATE_NAMES[state] && lastState === State.Playing) {
			const id = global.song?.songInfo?.id
			TrackPlayer.getProgress()
				.then(({ position }) => {
					logger.info('Playback', `Player ${STATE_NAMES[state]} at ${Math.round(position)} s: ${trackName()}`)
					if (state === State.Paused) savePosition(id, position)
				})
				.catch(() => logger.info('Playback', `Player ${STATE_NAMES[state]}: ${trackName()}`))
		}
		if (state !== State.Buffering && state !== State.Loading && state !== State.Ready) lastState = state
	})
	on(Event.PlaybackProgressUpdated, ({ position }) => savePosition(global.song?.songInfo?.id, position))
	on(Event.PlaybackError, (error) => {
		logger.error('PlaybackError', error.code, error.message)
	})
}
