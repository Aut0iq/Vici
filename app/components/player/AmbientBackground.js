import React from 'react'
import { Animated, Image, StyleSheet, View, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getColors } from 'react-native-image-colors'

import { useConfig } from '~/contexts/config'
import { urlCover } from '~/utils/url'

const INK = '#0E0A0F'

// Настройки размытия фона (можно менять под себя):
// BLUR_SIZE — размер копии обложки в пикселях: чем меньше, тем сильнее размытие (16–32)
// BLUR_RADIUS — дополнительное размытие этой копии (0–6)
// BLUR_SCALE — увеличение, чтобы спрятать края размытой картинки (1.2–1.5)
const BLUR_SIZE = 18
const BLUR_RADIUS = 4
const BLUR_SCALE = 1.35
const MISSING = '#010101'

// Цвета Vici — если не получилось взять цвета из обложки
const FALLBACK = { a: '#7a2a45', b: '#6d5a2a' }

// '#RRGGBB' + прозрачность -> 'rgba(r,g,b,a)'
const withAlpha = (hex, alpha) => {
	if (typeof hex !== 'string' || !/^#?[0-9a-f]{6}/i.test(hex)) return `rgba(0,0,0,${alpha})`
	const h = hex.replace('#', '')
	return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`
}

const firstColor = (...list) => list.find((c) => c && c.toLowerCase() !== MISSING)

// Выбираем два цвета из результата библиотеки (на разных платформах поля разные)
const pickColors = (res) => {
	if (!res) return FALLBACK
	if (res.platform === 'ios') {
		return { a: firstColor(res.primary, res.background) || FALLBACK.a, b: firstColor(res.secondary, res.detail) || FALLBACK.b }
	}
	return {
		a: firstColor(res.vibrant, res.lightVibrant, res.dominant) || FALLBACK.a,
		b: firstColor(res.darkVibrant, res.darkMuted, res.muted, res.dominant) || FALLBACK.b,
	}
}

const Wash = ({ colors, style }) => (
	<Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
		<LinearGradient
			colors={[withAlpha(colors.a, 0.45), withAlpha(colors.a, 0)]}
			start={{ x: 0, y: 0 }}
			end={{ x: 0.8, y: 0.6 }}
			style={StyleSheet.absoluteFill}
		/>
		<LinearGradient
			colors={[withAlpha(colors.b, 0.4), withAlpha(colors.b, 0)]}
			start={{ x: 1, y: 0.1 }}
			end={{ x: 0.2, y: 0.7 }}
			style={StyleSheet.absoluteFill}
		/>
	</Animated.View>
)

// Фон плеера: размытая обложка трека, подкрашенная её же яркими цветами
const AmbientBackground = ({ song }) => {
	const config = useConfig()
	const [colors, setColors] = React.useState(FALLBACK)
	const [prevColors, setPrevColors] = React.useState(FALLBACK)
	const fade = React.useRef(new Animated.Value(1)).current
	// Для цветов берём обложку 100px. Для фона — крошечную 32px: при растягивании
	// на весь экран она сама превращается в плавные пятна без «лесенок».
	const uri = song ? urlCover(config, song, 100) : null
	const blurUri = song ? urlCover(config, song, Platform.OS === 'web' ? 300 : BLUR_SIZE) : null
	const key = song?.coverArt || song?.albumId || song?.id
	const [failed, setFailed] = React.useState(false)
	React.useEffect(() => setFailed(false), [blurUri])

	React.useEffect(() => {
		if (!uri) return
		let cancelled = false
		getColors(uri, { fallback: MISSING, cache: true, key: key ? `vici-${key}` : uri })
			.then((res) => {
				if (cancelled) return
				setPrevColors(colors)
				setColors(pickColors(res))
				fade.setValue(0)
				Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }).start()
			})
			.catch(() => { })
		return () => { cancelled = true }
	}, [uri])

	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: INK }]} pointerEvents="none">
			{/* Сама обложка, сильно размытая и чуть увеличенная.
			    Если трека нет или обложка не загрузилась — только цветные переливы Vici */}
			{blurUri && !failed ? (
				<Image
					source={{ uri: blurUri }}
					blurRadius={Platform.OS === 'web' ? 90 : BLUR_RADIUS}
					onError={() => setFailed(true)}
					style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', transform: [{ scale: BLUR_SCALE }] }]}
				/>
			) : null}
			{/* Лёгкое затемнение, чтобы светлые обложки не превращались в серую кашу */}
			<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.38)' }]} />
			<Wash colors={prevColors} />
			<Wash colors={colors} style={{ opacity: fade }} />
			{/* Плавное затемнение к низу, чтобы кнопки и текст хорошо читались */}
			<LinearGradient
				colors={['rgba(14,10,15,0)', 'rgba(14,10,15,0.5)', 'rgba(14,10,15,0.9)']}
				locations={[0.4, 0.72, 1]}
				style={StyleSheet.absoluteFill}
			/>
			{/* Мелкое зерно поверх всего: убирает полосы на плавных переходах */}
			<Image
				source={require('~/../assets/noise.png')}
				resizeMode="repeat"
				style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
			/>
		</View>
	)
}

export default AmbientBackground
