import React from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'
import pkg from '~/../package.json'

import Text from '~/components/Text'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'

const SIGNATURE = 'aut0iq'
const GOLD = '#E6BD55'
const useNativeDriver = Platform.OS !== 'web'

const BrandCard = () => {
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const isActive = Boolean(settings.aut0iq)
	const spin = React.useRef(new Animated.Value(1)).current
	const glow = React.useRef(new Animated.Value(isActive ? 1 : 0)).current
	const letters = React.useRef(SIGNATURE.split('').map(() => new Animated.Value(isActive ? 1 : 0))).current
	const isFirst = React.useRef(true)

	React.useEffect(() => {
		if (isFirst.current) {
			isFirst.current = false
			return
		}
		spin.setValue(0)
		const order = isActive ? letters : [...letters].reverse()
		Animated.parallel([
			Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.6)), useNativeDriver }),
			Animated.sequence([
				Animated.timing(glow, { toValue: 1.3, duration: 250, useNativeDriver: false }),
				Animated.timing(glow, { toValue: isActive ? 1 : 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }),
			]),
			Animated.stagger(isActive ? 80 : 45, order.map((value) => Animated.spring(value, {
				toValue: isActive ? 1 : 0,
				friction: isActive ? 4 : 8,
				tension: isActive ? 110 : 140,
				useNativeDriver,
			}))),
		]).start()
	}, [isActive])

	const container = settingStyles.optionsContainer(theme)
	const baseWidth = container.borderWidth || 0
	const borderWidth = glow.interpolate({ inputRange: [0, 1, 1.3], outputRange: [baseWidth, 1.5, 2] })
	const borderColor = glow.interpolate({ inputRange: [0, 1, 1.3], outputRange: [theme.glassEdge || 'rgba(230,189,85,0)', GOLD, '#FFE296'] })
	const borderTopColor = glow.interpolate({ inputRange: [0, 1, 1.3], outputRange: [theme.glassHighlight || theme.glassEdge || 'rgba(230,189,85,0)', GOLD, '#FFE296'] })
	const tint = glow.interpolate({ inputRange: [0, 1, 1.3], outputRange: [0, 1, 1.6] })
	const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
	const scale = spin.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.18, 1] })

	return (
		<Animated.View style={[container, { borderWidth, borderColor, borderTopColor }]}>
			<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { opacity: tint }]} />
			<Pressable
				onPress={() => setSettings({ ...settings, aut0iq: !isActive })}
				style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.card])}
			>
				<Animated.Image
					source={require('~/../assets/icon.png')}
					style={[mainStyles.icon, { borderRadius: 12, transform: [{ perspective: 600 }, { rotateY }, { scale }] }]}
				/>
				<View style={{ flexDirection: 'column', justifyContent: 'center' }}>
					<Text style={[styles.brand, { color: theme.primaryTouch }]}>VICI</Text>
					<Text style={{ color: theme.secondaryText, fontSize: size.text.small }}>Version {pkg.version}</Text>
				</View>
				<View pointerEvents="none" style={styles.signature}>
					{letters.map((value, index) => (
						<Animated.View
							key={index}
							style={{
								opacity: value,
								transform: [
									{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
									{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
									{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
								],
							}}
						>
							<Text style={styles.letter}>{SIGNATURE[index]}</Text>
						</Animated.View>
					))}
				</View>
			</Pressable>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		paddingVertical: 10,
	},
	tint: {
		backgroundColor: 'rgba(230,189,85,0.05)',
	},
	brand: {
		fontSize: size.text.large,
		fontFamily: 'display',
		letterSpacing: 4,
		marginBottom: 0,
	},
	signature: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		paddingEnd: 6,
	},
	letter: {
		color: GOLD,
		fontSize: size.text.large,
		fontFamily: 'display',
		letterSpacing: 2,
		textShadowColor: 'rgba(230,189,85,0.75)',
		textShadowRadius: 10,
		textShadowOffset: { width: 0, height: 0 },
	},
})

export default BrandCard
