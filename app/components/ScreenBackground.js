import React from 'react'
import { View, StyleSheet } from 'react-native'

import { useTheme } from '~/contexts/theme'
import { NowPlayingBackground } from '~/components/player/AmbientBackground'

const ScreenBackground = ({ children, style, dim = 0.35 }) => {
	const theme = useTheme()

	return (
		<View style={[{ flex: 1, backgroundColor: theme.primaryBack }, style]}>
			{theme.ambient ? (
				<>
					<NowPlayingBackground />
					<View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(14,10,15,${dim})` }]} />
				</>
			) : null}
			{children}
		</View>
	)
}

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
