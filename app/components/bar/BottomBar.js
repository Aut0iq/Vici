import React from 'react'
import { Animated, Easing, View, Pressable, Platform, StyleSheet } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import GlassView, { USE_BLUR } from '~/components/GlassView'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

export const BAR_HEIGHT = 64
export const BAR_MARGIN = 12

const WHITE = 'rgba(246,240,232,0.72)'
const WHITE_DIM = 'rgba(246,240,232,0.3)'
const WHITE_ACTIVE = '#F6F0E8'
const GOLD = 'rgba(230,189,85,0.88)'
const GOLD_DIM = 'rgba(230,189,85,0.3)'
const WAVE_STEP = 90
const SHINE_WIDTH = 90
const useNativeDriver = Platform.OS !== 'web'

const TabItem = ({ route, index, position, state, descriptors, navigation }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const settings = useSettings()
	const [isGold, setIsGold] = React.useState(Boolean(settings.aut0iq))
	const bounce = React.useRef(new Animated.Value(0)).current

	React.useEffect(() => {
		const next = Boolean(settings.aut0iq)
		if (next === isGold) return
		const timer = setTimeout(() => {
			setIsGold(next)
			bounce.setValue(0)
			Animated.timing(bounce, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver }).start()
		}, position * WAVE_STEP)
		return () => clearTimeout(timer)
	}, [settings.aut0iq])

	const options = descriptors[route.key].options
	const isFocused = state.index === index
	const disabled = !config.query && route.name !== 'SettingsStack'
	const color = isGold
		? (isFocused ? WHITE_ACTIVE : (disabled ? GOLD_DIM : GOLD))
		: (isFocused ? theme.primaryTouch : (disabled ? WHITE_DIM : WHITE))
	const scale = bounce.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [1, 1.28, 0.94, 1] })
	const translateY = bounce.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -7, 0] })

	const onPress = () => {
		const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
		if (!isFocused && !event.defaultPrevented) {
			navigation.navigate(route.name, route.params)
		}
	}

	return (
		<Pressable
			onPress={onPress}
			onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
			disabled={disabled}
			style={({ pressed }) => [styles.tab, isFocused && (isGold ? styles.tabActiveGold : styles.tabActive), { opacity: pressed ? 0.6 : 1 }]}
		>
			<Animated.View style={{ alignItems: 'center', transform: [{ translateY }, { scale }] }}>
				<Icon name={options.icon} size={19} color={color} style={{ height: 22 }} />
				<Text numberOfLines={1} style={[styles.label, { color }]}>
					{t(options.label)}
				</Text>
			</Animated.View>
		</Pressable>
	)
}

const BottomBar = ({ state, descriptors, navigation }) => {
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const settings = useSettings()
	const keyboardIsOpen = useKeyboardIsOpen()
	const [width, setWidth] = React.useState(0)
	const shine = React.useRef(new Animated.Value(0)).current
	const isFirst = React.useRef(true)

	React.useEffect(() => {
		if (isFirst.current) {
			isFirst.current = false
			return
		}
		shine.setValue(0)
		Animated.timing(shine, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver }).start()
	}, [settings.aut0iq])

	if (!config.url || keyboardIsOpen) return null
	const tabs = state.routes
		.map((route, index) => ({ route, index }))
		.filter(({ route }) => descriptors[route.key].options.inBar !== false)
	const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-SHINE_WIDTH, width + SHINE_WIDTH] })
	const shineOpacity = shine.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] })

	return (
		<View
			style={[styles.wrap, { bottom: (insets.bottom || 8) + BAR_MARGIN, left: insets.left + 14, right: insets.right + 14 }]}
			pointerEvents="box-none"
		>
			<View style={styles.shadow} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
				{USE_BLUR ? <BlurView
					intensity={30}
					tint="dark"
					experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
					style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' }]}
				/> : null}
				<View style={[StyleSheet.absoluteFill, styles.tint]} />
				<GlassView radius={BAR_HEIGHT / 2} intensity={0.5} style={styles.bar}>
					{tabs.map(({ route, index }, position) => (
						<TabItem
							key={route.key}
							route={route}
							state={state}
							index={index}
							position={position}
							descriptors={descriptors}
							navigation={navigation}
						/>
					))}
				</GlassView>
				<View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shineClip]}>
					<Animated.View style={[styles.shine, { opacity: shineOpacity, transform: [{ translateX }, { skewX: '-20deg' }] }]}>
						<LinearGradient
							colors={['rgba(230,189,85,0)', 'rgba(255,228,150,0.55)', 'rgba(230,189,85,0)']}
							start={{ x: 0, y: 0.5 }}
							end={{ x: 1, y: 0.5 }}
							style={StyleSheet.absoluteFill}
						/>
					</Animated.View>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
	},
	shadow: {
		borderRadius: BAR_HEIGHT / 2,
		elevation: 10,
		backgroundColor: 'transparent',
	},
	tint: {
		borderRadius: BAR_HEIGHT / 2,
		backgroundColor: USE_BLUR ? 'rgba(22,15,21,0.15)' : 'rgba(22,15,21,0.6)',
	},
	bar: {
		height: BAR_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around',
		paddingHorizontal: 4,
	},
	shineClip: {
		borderRadius: BAR_HEIGHT / 2,
		overflow: 'hidden',
	},
	shine: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		width: SHINE_WIDTH,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 6,
		marginHorizontal: 1,
		borderRadius: 24,
	},
	tabActive: {
		backgroundColor: 'rgba(230,189,85,0.13)',
		borderWidth: 1,
		borderColor: 'rgba(230,189,85,0.25)',
	},
	tabActiveGold: {
		backgroundColor: 'rgba(246,240,232,0.12)',
		borderWidth: 1,
		borderColor: 'rgba(246,240,232,0.3)',
	},
	label: {
		fontSize: 10,
		fontWeight: 'bold',
		marginTop: 2,
	},
})

export default BottomBar
