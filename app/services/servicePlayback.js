import TrackPlayer, { Event, State } from "react-native-track-player"

import Player from "~/utils/player"
import { getApi } from "~/utils/api"
import { downloadNextSong } from "~/utils/player"
import { songReducer } from "~/contexts/song"
import logger from "~/utils/logger"
import { onTrackStart, onPlayingChange, onTrackEnd } from "~/services/scrobbler"

let lockDownload = false
let shouldPlay = false
let pauseTimer = null

const fakeSongDispatch = (action) => {
	songReducer(global.song, action)
}

module.exports = async () => {
	TrackPlayer.addEventListener(Event.RemotePlay, () => Player.resumeSong())
	TrackPlayer.addEventListener(Event.RemotePause, () => Player.pauseSong())
	TrackPlayer.addEventListener(Event.RemoteNext, () => Player.nextSong(global.config, global.song, fakeSongDispatch))
	TrackPlayer.addEventListener(Event.RemotePrevious, () => Player.previousSong(global.config, global.song, fakeSongDispatch))
	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => Player.setPosition(event.position))
	// This handles the interruptions like calls or notifications
	TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
		clearTimeout(pauseTimer)
		TrackPlayer.getPlaybackState()
			.then(({ state }) => {
				if (event.paused) {
					if (state === State.Playing) {
						if (event.permanent) {
							Player.stopSong()
							shouldPlay = false
						} else {
							TrackPlayer.setVolume(0.5)
							shouldPlay = true
							pauseTimer = setTimeout(async () => {
								Player.pauseSong()
							}, 5000)
						}
					}
				}
				else if (shouldPlay) {
					TrackPlayer.setVolume(1)
					Player.resumeSong()
					shouldPlay = false
				}
			})
	})
	TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (_event) => {
		if (!global.song?.queue?.length) return
		if (global.song?.songInfo?.id === 'tuktuktuk') return Player.resetAudio(global.songDispatch)
		onTrackEnd(global.song.actionEndOfSong === 'repeat')
		if (global.song.actionEndOfSong === 'repeat') {
			Player.setPosition(0)
			Player.resumeSong()
		} else if (!global.repeatQueue && global.song.index === global.song.queue.length - 1) {
			Player.stopSong()
		} else Player.nextSong(global.config, global.song, fakeSongDispatch)
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
	// Учёт времени прослушивания для скробблинга: считаем только время, когда реально играет
	TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
		onPlayingChange(state === State.Playing)
	})
	TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
		logger.error('PlaybackError', error.code, error.message)
	})
}
