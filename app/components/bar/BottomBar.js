import React from 'react'
import { Text, View, Pressable, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import GlassView, { USE_BLUR } from '~/components/GlassView'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

export const BAR_HEIGHT = 64
export const BAR_MARGIN = 12

// Свои иконки для вкладок
const ICONS = {
	HomeStack: 'home',
	SearchStack: 'search',
	MixesStack: 'magic',
	PlaylistsStack: 'list-ul',
	SettingsStack: 'gear',
}

const TabItem = ({ route, index, state, descriptors, navigation }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()

	const options = descriptors[route.key].options
	const isFocused = state.index === index
	const disabled = !config.query && route.name !== 'SettingsStack'
	const color = isFocused ? theme.primaryTouch : (disabled ? 'rgba(246,240,232,0.3)' : 'rgba(246,240,232,0.72)')

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
			style={({ pressed }) => [styles.tab, isFocused && styles.tabActive, { opacity: pressed ? 0.6 : 1 }]}
		>
			<Icon name={ICONS[route.name] || options.icon} size={19} color={color} style={{ height: 22 }} />
			<Text numberOfLines={1} style={[styles.label, { color }]}>
				{t(`tabs.${options.title}`)}
			</Text>
		</Pressable>
	)
}

// Нижнее меню: парящая стеклянная капсула, под которой видно контент
const BottomBar = ({ state, descriptors, navigation }) => {
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const keyboardIsOpen = useKeyboardIsOpen()

	if (!config.url || keyboardIsOpen) return null
	return (
		<View
			style={[styles.wrap, { bottom: (insets.bottom || 8) + BAR_MARGIN, left: insets.left + 14, right: insets.right + 14 }]}
			pointerEvents="box-none"
		>
			<View style={styles.shadow}>
				{USE_BLUR ? <BlurView
					intensity={30}
					tint="dark"
					experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
					style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' }]}
				/> : null}
				<View style={[StyleSheet.absoluteFill, styles.tint]} />
				<GlassView radius={BAR_HEIGHT / 2} intensity={0.5} style={styles.bar}>
					{state.routes.map((route, index) => (
						<TabItem
							key={route.key}
							route={route}
							state={state}
							index={index}
							descriptors={descriptors}
							navigation={navigation}
						/>
					))}
				</GlassView>
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
	label: {
		fontSize: 10,
		fontWeight: 'bold',
		marginTop: 2,
	},
})

export default BottomBar
