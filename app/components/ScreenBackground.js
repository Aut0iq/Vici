import React from 'react'
import { View, StyleSheet } from 'react-native'

import { useSong } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import AmbientBackground from '~/components/player/AmbientBackground'

// Фон экрана в стиле Vici: мягкие цвета текущего трека под стеклянными панелями.
// Для других тем — обычный сплошной фон.
const ScreenBackground = ({ children, style, dim = 0.35 }) => {
	const theme = useTheme()
	const song = useSong()

	return (
		<View style={[{ flex: 1, backgroundColor: theme.primaryBack }, style]}>
			{theme.ambient ? (
				<>
					<AmbientBackground song={song?.songInfo} />
					<View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(14,10,15,${dim})` }]} />
				</>
			) : null}
			{children}
		</View>
	)
}

// Обёртка для экранов навигации: экран получает фон Vici целиком
export const withBackground = (Component) => {
	const Wrapped = (props) => (
		<ScreenBackground>
			<Component {...props} />
		</ScreenBackground>
	)
	Wrapped.displayName = `withBackground(${Component.displayName || Component.name || 'Screen'})`
	return Wrapped
}

export default ScreenBackground
