import React from 'react'
import { View, Animated, Easing, Platform, Pressable } from 'react-native'

import { useConfig } from '~/contexts/config'
import { useSong } from '~/contexts/song'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import { LinearGradient } from 'expo-linear-gradient'
import State from '~/utils/playerState'

// Один оборот пластинки, в миллисекундах
const TURN_DURATION = 8000

// Обложка трека спереди, а за ней крутится пластинка.
// coverSize — сторона обложки, width — ширина всей области.
// translateX — сдвиг обложки при свайпе (жесты обрабатывает сам плеер), onDoubleTap — пауза
const VinylCover = ({ coverSize, width, translateX = null, onDoubleTap = null, onCoverTouch = null }) => {
	const config = useConfig()
	const song = useSong()
	const spin = React.useRef(new Animated.Value(0)).current
	const isPlaying = song.state === State.Playing
	const lastTap = React.useRef(0)

	const cover = Math.round(coverSize)
	const vinyl = Math.round(cover * 1.12)
	const shift = Math.round(cover * 0.28)
	// Сдвигаем обложку влево, чтобы обложка вместе с выглядывающей пластинкой стояли по центру
	const coverLeft = Math.max(0, Math.round((width - (cover / 2 + shift + vinyl / 2)) / 2))
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
			{/* Неподвижная тень под пластинкой: если тень вращается вместе с ней, Android её перерисовывает и она мерцает */}
			<View
				style={[
					circle(vinyl),
					{ position: 'absolute', left: vinylLeft, top: 0, backgroundColor: '#17131a', elevation: 12 },
				]}
			/>

			{/* Пластинка. renderToHardwareTextureAndroid — рисуем её один раз и дальше только поворачиваем картинку,
			    без перерисовки тонких дорожек на каждом кадре */}
			<Animated.View
				renderToHardwareTextureAndroid={true}
				shouldRasterizeIOS={true}
				style={[
					circle(vinyl),
					{
						position: 'absolute',
						left: vinylLeft,
						top: 0,
						backgroundColor: '#17131a',
						borderWidth: 1,
						borderColor: 'rgba(255,255,255,0.12)',
						transform: [{ rotate }],
					},
				]}
			>
				{/* Дорожки */}
				{[0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5].map((k, i) => (
					<View
						key={k}
						style={[circle(vinyl * k), centered(vinyl * k), { borderWidth: 1, borderColor: i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.35)' }]}
					/>
				))}
				{/* Блики: светлые сектора, которые вращаются вместе с пластинкой */}
				<View
					style={[
						circle(vinyl),
						centered(vinyl),
						{
							borderWidth: vinyl / 2,
							borderColor: 'transparent',
							borderTopColor: 'rgba(255,255,255,0.13)',
							borderBottomColor: 'rgba(255,255,255,0.08)',
						},
					]}
				/>
				<View style={[circle(vinyl), centered(vinyl), { overflow: 'hidden' }]}>
					<LinearGradient
						colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.10)']}
						locations={[0, 0.4, 0.62, 1]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={{ width: '100%', height: '100%' }}
					/>
				</View>
				{/* Золотая риска у края — по ней хорошо видно вращение */}
				<View style={{ position: 'absolute', left: vinyl / 2 - 2, top: vinyl * 0.04, width: 4, height: vinyl * 0.08, borderRadius: 2, backgroundColor: 'rgba(230,189,85,0.55)' }} />
				{/* Наклейка в центре */}
				<View style={[circle(vinyl * 0.4), centered(vinyl * 0.4), { backgroundColor: '#7a211d', borderWidth: 3, borderColor: '#0f0c0d' }]} />
				<View style={[circle(vinyl * 0.2), centered(vinyl * 0.2), { borderWidth: 1, borderColor: 'rgba(230,189,85,0.45)' }]} />
				<View style={[circle(8), centered(8), { backgroundColor: '#0c0a0b' }]} />
			</Animated.View>

			{/* Обложка: свайп влево/вправо — переключить трек, двойной тап — пауза */}
			<Animated.View
				// Сообщаем плееру, что палец лёг на обложку — тогда свайп влево/вправо переключит трек
				onTouchStart={() => onCoverTouch?.(true)}
				onTouchEnd={() => onCoverTouch?.(false)}
				onTouchCancel={() => onCoverTouch?.(false)}
				style={{
					position: 'absolute',
					left: coverLeft,
					top: coverTop,
					width: cover,
					height: cover,
					borderRadius: 22,
					backgroundColor: '#1d191c',
					elevation: 18,
					transform: translateX ? [{ translateX }] : [],
				}}
			>
				<Pressable
					onPress={() => {
						const now = Date.now()
						if (now - lastTap.current < 300) {
							lastTap.current = 0
							onDoubleTap?.()
						} else lastTap.current = now
					}}
				>
					<ImageError
						source={{ uri: urlCover(config, song?.songInfo) }}
						style={{ width: cover, height: cover, borderRadius: 22 }}
					/>
				</Pressable>
			</Animated.View>
		</View>
	)
}

export default VinylCover
