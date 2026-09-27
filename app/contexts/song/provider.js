import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, AppState } from 'react-native'

import Player from '~/utils/player'
import { getApi } from '~/utils/api'
import logger from '~/utils/logger'
import State from '~/utils/playerState'
import { queueWithout } from '~/utils/tools'
import { SongContext, SongDispatchContext } from '~/contexts/song/context'

export const SongProvider = ({ children }) => {
	const [song, dispatch] = React.useReducer(songReducer, defaultSong)

	React.useEffect(() => {
		if (!song.isInit) {
			if (Platform.OS === 'android') {
				if (AppState.currentState === 'active') {
					Player.initPlayer(dispatch)
					return
				}
				const subscription = AppState.addEventListener('change', (appState) => {
					if (appState === 'active') {
						Player.initPlayer(dispatch)
						subscription.remove()
					}
				})
				return () => {
					subscription.remove()
				}
			} else {
				Player.initPlayer(dispatch)
			}
		}
	}, [])

	useEndlessQueue(song, dispatch)

	return (
		<SongDispatchContext.Provider value={dispatch}>
			<SongContext.Provider value={song}>
				{children}
			</SongContext.Provider>
		</SongDispatchContext.Provider>
	)
}

const ENDLESS_BATCH = 50
const ENDLESS_THRESHOLD = 5

const remainingTracks = (song) => {
	if (song.actionEndOfSong === 'random' && song.randomIndex?.length) {
		const position = song.randomIndex.indexOf(song.index)
		if (position !== -1) return song.randomIndex.length - 1 - position
	}
	return song.queue.length - 1 - song.index
}

const useEndlessQueue = (song, dispatch) => {
	const loading = React.useRef(false)

	React.useEffect(() => {
		if (!song.endless || !song.queue?.length || loading.current) return
		if (remainingTracks(song) > ENDLESS_THRESHOLD) return
		loading.current = true
		getApi(global.config, 'getRandomSongs', { ...song.endless, size: ENDLESS_BATCH })
			.then((json) => {
				const known = new Set(global.song?.queue?.map((track) => track.id))
				const tracks = (json.randomSongs?.song || []).filter((track) => !known.has(track.id))
				if (tracks.length) dispatch({ type: 'appendToQueue', tracks })
			})
			.catch((error) => logger.warn('EndlessQueue', `Random songs not loaded: ${error?.message || error}`))
			.finally(() => { loading.current = false })
	}, [song.endless, song.index, song.queue?.length, song.actionEndOfSong])
}

const convertTrack = (track) => {
	return {
		id: track.id,
		title: track.title,
		artist: track.artist,
		artists: track.artists,
		artistId: track.artistId,
		album: track.album,
		albumId: track.albumId,
		duration: track.duration,
		covertArt: track.covertArt,
		track: track.track,
		starred: track.starred,
		userRating: track.userRating ?? track.rating ?? 0,
		size: track.size,
		index: track.index,
		mediaType: track.mediaType,
		homePageUrl: track.homePageUrl,
		name: track.name,
		streamUrl: track.streamUrl,
	}
}

const newSong = (state, action, isCache = false) => {
	const song = {
		...state,
		...action,
	}
	global.song = song
	if (isCache) {
		AsyncStorage.setItem('song', JSON.stringify(song))
			.catch((error) => logger.error('newSong', 'Error saving song to AsyncStorage:', error))
	}
	return song
}

export const songReducer = (state, action) => {
	switch (action.type) {
		case 'init':
			return newSong(state, {
				isInit: true,
			})
		case 'restore':
			return newSong(state, {
				queue: action.song.queue || null,
				songInfo: action.song.songInfo || null,
				index: action.song.index || 0,
				actionEndOfSong: action.song.actionEndOfSong || 'next',
				randomIndex: action.song.randomIndex || [],
				endless: action.song.endless || null,
				isSongLoad: action.isSongLoad || false,
			})
		case 'setQueue': {
			const newQueue = action.queue.map((track) => convertTrack(track))
			return newSong(state, {
				songInfo: newQueue[action.index],
				index: action.index,
				queue: newQueue,
				endless: action.endless || null,
				isSongLoad: true,
			}, true)
		}
		case 'appendToQueue': {
			if (!state.queue?.length || !action.tracks?.length) return state
			const start = state.queue.length
			const tracks = action.tracks.map((track) => convertTrack(track))
			return newSong(state, {
				queue: [...state.queue, ...tracks],
				randomIndex: state.randomIndex?.length
					? [...state.randomIndex, ...tracks.map((_, i) => start + i)]
					: [],
			}, true)
		}
		case 'setIndex':
			if (!state.queue || state.queue?.length <= action.index) return state
			return newSong(state, {
				index: action.index,
				songInfo: state.queue[action.index],
			}, true)
		case 'setState': {
			if (action.state === state.state || !action.state) return state
			return newSong(state, {
				state: action.state,
			})
		}
		case 'addToQueue': {
			if (!state.songInfo || !state.queue) return state
			const newQueue = [...state.queue]
			if (action.index === null || action.index >= newQueue.length) {
				newQueue.push(action.track)
			} else {
				newQueue.splice(action.index, 0, action.track)
			}

			const inserted = (action.index === null || action.index >= state.queue.length) ? newQueue.length - 1 : action.index
			return newSong(state, {
				queue: newQueue,
				index: (typeof action.index === 'number' && state.index >= action.index) ? state.index + 1 : state.index,
				randomIndex: state.randomIndex?.length
					? [...state.randomIndex.map((i) => (i >= inserted ? i + 1 : i)), inserted]
					: [],
			}, true)
		}
		case 'setRating': {
			if (!state.queue?.length) return state
			const newQueue = state.queue.map((track) => {
				if (track.id !== action.id) return track
				return {
					...track,
					userRating: action.rating,
					rating: action.rating,
				}
			})
			const songInfo = state.songInfo?.id === action.id ? {
				...state.songInfo,
				userRating: action.rating,
				rating: action.rating,
			} : state.songInfo
			return newSong(state, {
				queue: newQueue,
				songInfo,
			}, true)
		}
		case 'removeFromQueue': {
			if (!state.queue || state.queue.length <= 1 || state.queue.length <= action.index) return state
			const { queue, index, randomIndex } = queueWithout(state, action.index)
			return newSong(state, {
				queue,
				index,
				songInfo: queue[index] || null,
				randomIndex,
			}, true)
		}
		case 'setActionEndOfSong':
			if (['next', 'repeat', 'random'].indexOf(action.action) === -1) return state
			if (action.action === 'random') {
				if (state.queue?.length) {
					const allIndex = state.queue.map((_, index) => index)
					const randomIndex = []
					while (randomIndex.length < state.queue.length) {
						const index = Math.floor(Math.random() * allIndex.length)
						randomIndex.push(allIndex[index])
						allIndex.splice(index, 1)
					}
					return newSong(state, {
						actionEndOfSong: action.action,
						randomIndex
					}, true)
				}
			}
			return newSong(state, {
				actionEndOfSong: action.action,
			}, true)
		case 'reset':
			return newSong(state, {
				...defaultSong,
				isInit: true,
				isSongLoad: false,
			}, true)
		default:
			logger.error('songReducer', 'Unknown action', action)
			return state
	}
}

export const defaultSong = {
	isInit: false,
	songInfo: null,
	queue: null,
	index: 0,
	actionEndOfSong: 'next',
	randomIndex: [],
	endless: null,
	state: State.Stopped,
}
