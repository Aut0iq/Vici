import React from 'react'
import { View, Animated, Easing, Platform } from 'react-native'

import { useConfig } from '~/contexts/config'
import { useSong } from '~/contexts/song'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import Player from '~/utils/player'
import SlideControl from '~/components/button/SlideControl'

// Один оборот пластинки, в миллисекундах
const TURN_DURATION = 8000

// Обложка трека спереди, а за ней крутится пластинка.
// coverSize — сторона обложки, width — ширина всей области.
const VinylCover = ({ coverSize, width }) => {
	const config = useConfig()
	const song = useSong()
	const spin = React.useRef(new Animated.Value(0)).current
	const isPlaying = song.state === Player.State.Playing

	const cover = Math.round(coverSize)
	const vinyl = Math.round(cover * 1.12)
	const shift = Math.round(cover * 0.24)
	const coverLeft = Math.round((width - cover) / 2)
	const coverTop = Math.round((vinyl - cover) / 2)
	const vinylLeft = coverLeft + Math.round((cover - vinyl) / 2) + shift

	// Крутим, пока играет музыка; на паузе останавливаемся там, где были
	React.useEffect(() => {
		if (!isPlaying) {
			spin.stopAnimation()
			return
		}
		let cancelled = false
		const run = (from) => {
			spin.setValue(from)
			Animated.timing(spin, {
				toValue: 1,
				duration: Math.max(1, (1 - from) * TURN_DURATION),
				easing: Easing.linear,
				useNativeDriver: Platform.OS !== 'web',
			}).start(({ finished }) => {
				if (finished && !cancelled) run(0)
			})
		}
		spin.stopAnimation((value) => run(value >= 1 ? 0 : value))
		return () => {
			cancelled = true
			spin.stopAnimation()
		}
	}, [isPlaying])

	const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
	const circle = (d) => ({ width: d, height: d, borderRadius: d / 2 })
	const centered = (d) => ({ position: 'absolute', left: (vinyl - d) / 2 - 1, top: (vinyl - d) / 2 - 1 })

	return (
		<View style={{ width, height: vinyl }}>
			{/* Пластинка */}
			<Animated.View
				style={[
					circle(vinyl),
					{
						position: 'absolute',
						left: vinylLeft,
						top: 0,
						backgroundColor: '#141113',
						borderWidth: 1,
						borderColor: 'rgba(255,255,255,0.12)',
						elevation: 12,
						transform: [{ rotate }],
					},
				]}
			>
				{/* Дорожки */}
				{[0.93, 0.86, 0.79, 0.72, 0.65, 0.58, 0.51].map((k) => (
					<View
						key={k}
						style={[circle(vinyl * k), centered(vinyl * k), { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }]}
					/>
				))}
				{/* Блики — по ним видно, что пластинка крутится */}
				<View
					style={[
						circle(vinyl),
						centered(vinyl),
						{
							borderWidth: vinyl * 0.29,
							borderColor: 'transparent',
							borderTopColor: 'rgba(255,255,255,0.10)',
							borderBottomColor: 'rgba(255,255,255,0.06)',
						},
					]}
				/>
				{/* Наклейка в центре */}
				<View style={[circle(vinyl * 0.4), centered(vinyl * 0.4), { backgroundColor: '#7a211d', borderWidth: 3, borderColor: '#0f0c0d' }]} />
				<View style={[circle(vinyl * 0.2), centered(vinyl * 0.2), { borderWidth: 1, borderColor: 'rgba(230,189,85,0.45)' }]} />
				<View style={[circle(8), centered(8), { backgroundColor: '#0c0a0b' }]} />
			</Animated.View>

			{/* Обложка: свайп влево/вправо — переключить трек, двойной тап — пауза */}
			<SlideControl
				style={{
					position: 'absolute',
					left: coverLeft,
					top: coverTop,
					width: cover,
					height: cover,
					borderRadius: 22,
					backgroundColor: '#1d191c',
					elevation: 18,
				}}
			>
				<ImageError
					source={{ uri: urlCover(config, song?.songInfo) }}
					style={{ width: cover, height: cover, borderRadius: 22 }}
				/>
			</SlideControl>
		</View>
	)
}

export default VinylCover
