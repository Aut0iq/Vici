import TrackPlayer, { Event, State } from "react-native-track-player"

import Player from "~/utils/player"
import { downloadNextSong } from "~/utils/player"
import { songReducer } from "~/contexts/song"
import logger from "~/utils/logger"
import { onTrackStart, onPlayingChange, onTrackEnd } from "~/services/scrobbler"

let lockDownload = false
let shouldPlay = false
let pauseTimer = null

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
	TrackPlayer.addEventListener(Event.RemotePlay, () => Player.resumeSong())
	TrackPlayer.addEventListener(Event.RemotePause, () => {
		logger.info('Playback', `Paused from the notification, lock screen or headset: ${trackName()}`)
		Player.pauseSong()
	})
	TrackPlayer.addEventListener(Event.RemoteStop, () => logger.info('Playback', `Stop from the notification or headset: ${trackName()}`))
	TrackPlayer.addEventListener(Event.RemoteNext, () => Player.nextSong(global.config, global.song, songDispatch))
	TrackPlayer.addEventListener(Event.RemotePrevious, () => Player.previousSong(global.config, global.song, songDispatch))
	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => Player.setPosition(event.position))
	TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
		clearTimeout(pauseTimer)
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
							pauseTimer = setTimeout(async () => {
								logger.info('Playback', 'Paused: audio focus did not come back within 5 s')
								Player.pauseSong()
							}, 5000)
						}
					}
				}
				else if (shouldPlay) {
					logger.info('Playback', 'Audio focus returned, resuming')
					TrackPlayer.setVolume(1)
					Player.resumeSong()
					shouldPlay = false
				}
			})
	})
	TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (_event) => {
		if (!global.song?.queue?.length) return
		onTrackEnd(global.song.actionEndOfSong === 'repeat')
		if (global.song.actionEndOfSong === 'repeat') {
			Player.setPosition(0)
			Player.resumeSong()
		} else if (!global.repeatQueue && global.song.index === global.song.queue.length - 1) {
			logger.info('Playback', 'Stopped: the queue has ended and repeat is off')
			Player.stopSong()
		} else Player.nextSong(global.config, global.song, songDispatch)
	})
	TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
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
	TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
		onPlayingChange(state === State.Playing)
		if (STATE_NAMES[state] && lastState === State.Playing) {
			TrackPlayer.getProgress()
				.then(({ position }) => logger.info('Playback', `Player ${STATE_NAMES[state]} at ${Math.round(position)} s: ${trackName()}`))
				.catch(() => logger.info('Playback', `Player ${STATE_NAMES[state]}: ${trackName()}`))
		}
		if (state !== State.Buffering && state !== State.Loading && state !== State.Ready) lastState = state
	})
	TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
		logger.error('PlaybackError', error.code, error.message)
	})
}
