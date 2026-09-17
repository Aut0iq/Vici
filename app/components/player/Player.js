import React from 'react'
import { useWindowDimensions, Linking } from 'react-native'

import { useSettings } from '~/contexts/settings'
import { useSong } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import { updateWidget } from '~/widget'
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