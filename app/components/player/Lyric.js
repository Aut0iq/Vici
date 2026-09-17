import React from 'react'
import { FlatList, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'

import Text from '~/components/Text'
import { useTheme } from '~/contexts/theme'
import { useConfig } from '~/contexts/config'
import { fetchLyrics } from '~/utils/lyrics'
import Player from '~/utils/player'

const Lyric = ({ song, style, color = null, sizeText = 23, activeSizeText = null, gap = 30, paddingVertical = 0, onAvailable = null }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const time = Player.updateTime()
	const refScroll = React.useRef(null)
	const [lyrics, setLyrics] = React.useState({ synced: false, lines: [] })
	const [status, setStatus] = React.useState('loading')
	const [indexCurrent, setIndex] = React.useState(-1)
	const onAvailableRef = React.useRef(onAvailable)
	onAvailableRef.current = onAvailable

	const songId = song?.songInfo?.id

	// Загружаем текст. Если трек успели переключить, ответ для старого трека игнорируется —
	// поэтому тексты больше не путаются между песнями.
	React.useEffect(() => {
		if (!songId) return
		const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
		let active = true
		setLyrics({ synced: false, lines: [] })
		setStatus('loading')
		setIndex(-1)

		fetchLyrics(config, song.songInfo, { signal: controller?.signal })
			.then((result) => {
				if (!active) return
				if (result?.lines?.length) {
					setLyrics(result)
					setStatus('ready')
					onAvailableRef.current?.(true)
				} else {
					setStatus('none')
					onAvailableRef.current?.(false)
				}
			})
			.catch(() => {
				if (!active) return
				setStatus('none')
				onAvailableRef.current?.(false)
			})

		return () => {
			active = false
			controller?.abort()
		}
	}, [songId])

	// Текущая строка по времени трека
	React.useEffect(() => {
		if (!lyrics.synced || !lyrics.lines.length) return
		let index = lyrics.lines.findIndex((ly) => ly.time > time.position) - 1
		if (index === -2) index = lyrics.lines.length - 1
		if (index !== indexCurrent) setIndex(index)
	}, [time.position, lyrics])

	React.useEffect(() => {
		if (indexCurrent < 0 || !refScroll.current) return
		refScroll.current.scrollToIndex({ index: indexCurrent, animated: true, viewOffset: 0, viewPosition: 0.5 })
	}, [indexCurrent])

	const data = status === 'ready' ? lyrics.lines : [{ time: null, text: status === 'loading' ? t('Loading lyrics...') : t('No lyrics found') }]

	return (
		<FlatList
			ref={refScroll}
			style={[style, { borderRadius: null }]}
			contentContainerStyle={{ gap, paddingVertical }}
			showsVerticalScrollIndicator={false}
			onScrollToIndexFailed={() => { }}
			initialNumToRender={data.length}
			data={data}
			keyExtractor={(item, index) => `${songId}-${index}`}
			renderItem={({ item, index }) => {
				const isCurrent = lyrics.synced && index === indexCurrent
				return (
					<Pressable
						disabled={item.time === null}
						onPress={() => Player.setPosition(item.time)}
					>
						<Text
							style={{
								color: isCurrent ? color?.active || theme.primaryText : color?.inactive || theme.secondaryText,
								fontSize: isCurrent && activeSizeText ? activeSizeText : sizeText,
								fontWeight: isCurrent && activeSizeText ? 'bold' : 'normal',
								paddingHorizontal: 16,
								textAlign: 'center',
							}}>
							{item.text?.length ? item.text : '♪'}
						</Text>
					</Pressable>
				)
			}}
		/>
	)
}

export default Lyric
