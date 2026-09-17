import React from 'react'
import { useWindowDimensions, Linking } from 'react-native'

import { useSettings } from '~/contexts/settings'
import { useSong } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import { updateWidget } from '~/widget'
import { addDeviceConnectedListener, isExternalConnected } from '~/../modules/audio-route'
import logger from '~/utils/logger'
import BoxDesktopPlayer from '~/components/player/BoxDesktopPlayer'
import BoxPlayer from '~/components/player/BoxPlayer'
import FullScreenHorizontalPlayer from '~/components/player/FullScreenHorizontalPlayer'
import FullScreenPlayer from '~/components/player/FullScreenPlayer'

const Player = ({ state }) => {
	const song = useSong()
	const settings = useSettings()
	const { height, width } = useWindowDimensions()
	const [fullScreen, setFullScreen] = React.useState(false)

	const config = useConfig()

	React.useEffect(() => {
		setFullScreen(false)
	}, [state.index])

	// Открытие из виджета (ссылка vici://player) — сразу плеер на весь экран
	React.useEffect(() => {
		const open = (url) => {
			if (url && url.startsWith('vici://player')) setFullScreen(true)
		}
		Linking.getInitialURL().then(open).catch(() => { })
		const sub = Linking.addEventListener('url', ({ url }) => open(url))
		return () => sub.remove()
	}, [])

	// При первом запуске: если наушники уже подключены — продолжаем играть.
	// Вместе с правилом Samsung «подключены наушники → открыть Vici» это даёт автозапуск,
	// даже когда приложение было полностью закрыто
	React.useEffect(() => {
		if (!settings.playOnHeadphonesConnect || global.viciAutoPlayChecked) return
		global.viciAutoPlayChecked = true
		let cancelled = false
		isExternalConnected().then((connected) => {
			if (!connected || cancelled) return
			setTimeout(() => {
				const current = global.song
				if (!current?.queue?.length || current.state === Player.State.Playing) return
				logger.info('Player', 'Headphones already connected on start, resuming')
				if (current.isSongLoad) Player.resumeSong()
				else Player.playSong(global.config || config, songDispatch, current.queue, current.index)
			}, 1500)
		})
		return () => { cancelled = true }
	}, [settings.playOnHeadphonesConnect])

	// Подключили наушники или колонку — продолжаем играть (если включено в настройках)
	React.useEffect(() => {
		if (!settings.playOnHeadphonesConnect) return
		return addDeviceConnectedListener(({ type }) => {
			const current = global.song
			if (!current?.queue?.length || current.state === Player.State.Playing) return
			logger.info('Player', `Audio device connected (${type}), resuming`)
			// Небольшая пауза: звуковому выходу нужно время, чтобы переключиться на наушники
			setTimeout(() => {
				if (global.song?.state === Player.State.Playing) return
				if (global.song?.isSongLoad) Player.resumeSong()
				else Player.playSong(global.config || config, songDispatch, global.song.queue, global.song.index)
			}, 1200)
		})
	}, [settings.playOnHeadphonesConnect])

	// Держим виджет на рабочем столе в курсе: трек, обложка, пауза
	React.useEffect(() => {
		updateWidget(config, song)
	}, [song?.songInfo?.id, song?.state, config?.url])

	if (!song?.songInfo) return null
	else if (fullScreen) {
		if (width <= height) return <FullScreenPlayer setFullScreen={setFullScreen} />
		else return <FullScreenHorizontalPlayer setFullScreen={setFullScreen} />
	}
	else if (settings.isDesktop) return <BoxDesktopPlayer setFullScreen={setFullScreen} />
	return <BoxPlayer setFullScreen={setFullScreen} />
}

export default Player