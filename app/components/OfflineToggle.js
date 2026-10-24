import React from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'

import Text from '~/components/Text'
import { useOfflineMode, useSetOfflineMode } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'

const useNativeDriver = Platform.OS !== 'web'

const OfflineToggle = ({ children, style, labelStyle }) => {
	const theme = useTheme()
	const offline = useOfflineMode()
	const setOffline = useSetOfflineMode()
	const pulse = React.useRef(new Animated.Value(1)).current
	const shown = React.useRef(new Animated.Value(offline ? 1 : 0)).current
	const [ringColor, setRingColor] = React.useState(theme.primaryTouch)

	React.useEffect(() => {
		Animated.timing(shown, {
			toValue: offline ? 1 : 0,
			duration: 360,
			delay: offline ? 220 : 0,
			easing: Easing.out(Easing.cubic),
			useNativeDriver,
		}).start()
	}, [offline])

	const toggle = () => {
		const next = !offline
		setRingColor(next ? theme.secondaryText : theme.primaryTouch)
		pulse.setValue(0)
		Animated.timing(pulse, {
			toValue: 1,
			duration: 700,
			easing: Easing.out(Easing.cubic),
			useNativeDriver,
		}).start()
		setOffline(next)
	}

	const scale = pulse.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1, 0.84, 1.06, 1] })
	const rotateY = pulse.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
	const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] })
	const ringOpacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] })
	const labelShift = shown.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] })

	return (
		<Pressable onPress={toggle} hitSlop={8} style={[styles.row, style]}>
			<View>
				<Animated.View
					pointerEvents="none"
					style={[StyleSheet.absoluteFill, styles.ring, { borderColor: ringColor, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
				/>
				<Animated.View style={{ opacity: offline ? 0.75 : 1, transform: [{ perspective: 600 }, { scale }, { rotateY }] }}>
					{children}
				</Animated.View>
			</View>
			<Animated.View pointerEvents="none" style={{ opacity: shown, transform: [{ translateX: labelShift }] }}>
				<Text style={[styles.label, { color: theme.secondaryText }, labelStyle]}>offline</Text>
			</Animated.View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	ring: {
		borderWidth: 2,
		borderRadius: 999,
	},
	label: {
		marginLeft: 10,
		fontSize: 13,
		letterSpacing: 1,
	},
})

export default OfflineToggle
