import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget'

import { urlCover } from '~/utils/url'
import { songReducer } from '~/contexts/song'
import Player from '~/utils/player'
import State from '~/utils/playerState'
import { ViciWidget, WIDGET_NAME } from '~/widget/ViciWidget'

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
	const state = {
		title: info?.title || '',
		artist: info?.artist || '',
		cover: info ? urlCover(config, info, 100) : null,
		isPlaying: song?.state === State.Playing,
	}
	try {
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
		await requestWidgetUpdate({
			widgetName: WIDGET_NAME,
			renderWidget: () => <ViciWidget {...state} />,
			widgetNotFound: () => { },
		})
	} catch { }
}

// Кнопки виджета работают так же, как кнопки в уведомлении плеера
const dispatch = (action) => {
	if (global.songDispatch) global.songDispatch(action)
	else if (global.song) songReducer(global.song, action)
}

const widgetTaskHandler = async ({ widgetAction, clickAction, renderWidget }) => {
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

	if (widgetAction !== 'WIDGET_DELETED') renderWidget(<ViciWidget {...state} />)
}

export const registerWidget = () => registerWidgetTaskHandler(widgetTaskHandler)
