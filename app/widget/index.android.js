import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget'
import { getColors } from 'react-native-image-colors'

import { urlCover } from '~/utils/url'
import { songReducer } from '~/contexts/song'
import Player from '~/utils/player'
import State from '~/utils/playerState'
import { ViciWidget, WIDGET_NAME, DEFAULT_COLORS } from '~/widget/ViciWidget'

const MISSING = '#010101'
const INK = [14, 10, 15]

const toRgb = (hex) => {
	if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex) || hex.toLowerCase() === MISSING) return null
	return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
// Смешиваем цвет обложки с тёмным фоном Vici, чтобы текст на виджете всегда читался
const mix = (rgb, amount) => rgb.map((c, i) => Math.round(c * (1 - amount) + INK[i] * amount))
const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`

// Цвета виджета из обложки — те же, что у фона плеера
const pickWidgetColors = async (uri, key) => {
	if (!uri) return DEFAULT_COLORS
	try {
		const res = await getColors(uri, { fallback: MISSING, cache: true, key: key ? `vici-${key}` : uri })
		const main = toRgb(res.vibrant) || toRgb(res.dominant) || toRgb(res.lightVibrant)
		const second = toRgb(res.darkVibrant) || toRgb(res.darkMuted) || toRgb(res.muted) || main
		if (!main) return DEFAULT_COLORS
		// Сплошной цвет: плавный градиент на виджетах Android рисуется ступеньками
		return {
			background: rgba(mix(main, 0.5), 1),
			edge: rgba(mix(second, 0.2), 0.6),
		}
	} catch {
		return DEFAULT_COLORS
	}
}

const STORAGE_KEY = 'vici.widget'

const readState = async () => {
	try {
		return JSON.parse(await AsyncStorage.getItem(STORAGE_KEY)) || {}
	} catch {
		return {}
	}
}

// Вызывается из приложения при смене трека или паузе: запоминаем и перерисовываем виджет
export const updateWidget = async (config, song) => {
	const info = song?.songInfo
	const cover = info ? urlCover(config, info, 300) : null
	const colorUri = info ? urlCover(config, info, 100) : null
	const previous = await readState()
	const sameTrack = previous.id && previous.id === info?.id
	const state = {
		id: info?.id || null,
		title: info?.title || '',
		artist: info?.artist || '',
		cover,
		isPlaying: song?.state === State.Playing,
		// Цвета пересчитываем только при смене трека, на паузе берём прежние
		colors: sameTrack && previous.colors?.background ? previous.colors : await pickWidgetColors(colorUri, info?.coverArt || info?.albumId || info?.id),
	}
	try {
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
		await requestWidgetUpdate({
			widgetName: WIDGET_NAME,
			renderWidget: (widgetInfo) => <ViciWidget {...state} height={widgetInfo?.height} />,
			widgetNotFound: () => { },
		})
	} catch { }
}

// Кнопки виджета работают так же, как кнопки в уведомлении плеера
const dispatch = (action) => {
	if (global.songDispatch) global.songDispatch(action)
	else if (global.song) songReducer(global.song, action)
}

const widgetTaskHandler = async ({ widgetInfo, widgetAction, clickAction, renderWidget }) => {
	const state = await readState()

	if (widgetAction === 'WIDGET_CLICK' && global.song?.songInfo) {
		try {
			if (clickAction === 'PLAY_PAUSE') {
				if (global.song.state === State.Playing) {
					await Player.pauseSong()
					state.isPlaying = false
				} else {
					await Player.resumeSong()
					state.isPlaying = true
				}
			} else if (clickAction === 'NEXT') {
				await Player.nextSong(global.config, global.song, dispatch)
			} else if (clickAction === 'PREV') {
				await Player.previousSong(global.config, global.song, dispatch)
			}
		} catch { }
	}

	if (widgetAction !== 'WIDGET_DELETED') renderWidget(<ViciWidget {...state} height={widgetInfo?.height} />)
}

export const registerWidget = () => registerWidgetTaskHandler(widgetTaskHandler)
