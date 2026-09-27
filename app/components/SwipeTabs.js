import React from 'react'
import { View, PanResponder, useWindowDimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { useSettings } from '~/contexts/settings'

const MIN_DISTANCE = 20
const DIRECTION_RATIO = 2
const SWITCH_DISTANCE = 60
const EDGE_ZONE = 40

const isHorizontal = (gesture) => (
	Math.abs(gesture.dx) > MIN_DISTANCE && Math.abs(gesture.dx) > Math.abs(gesture.dy) * DIRECTION_RATIO
)

const SwipeTabs = ({ children }) => {
	const navigation = useNavigation()
	const settings = useSettings()
	const { width } = useWindowDimensions()
	const enabled = settings.tabSwipe !== false && !settings.isDesktop

	const stateRef = React.useRef({})
	stateRef.current = { enabled, width, tabsOrder: settings.tabsOrder, navigation }

	const swipeTo = React.useCallback((direction) => {
		const { tabsOrder, navigation: nav } = stateRef.current
		const parent = nav.getParent()
		if (!parent) return
		const state = parent.getState()
		const names = state.routes
			.map((route) => route.name)
			.filter((name) => tabsOrder?.find((tab) => tab.id === name)?.swipe)
		const current = names.indexOf(state.routes[state.index]?.name)
		if (current === -1) return
		const next = names[current + direction]
		if (next) parent.navigate(next)
	}, [])

	const panResponder = React.useMemo(() => PanResponder.create({
		onMoveShouldSetPanResponderCapture: (_, gesture) => (
			stateRef.current.enabled
			&& isHorizontal(gesture)
			&& (gesture.x0 < EDGE_ZONE || gesture.x0 > stateRef.current.width - EDGE_ZONE)
		),
		onMoveShouldSetPanResponder: (_, gesture) => stateRef.current.enabled && isHorizontal(gesture),
		onPanResponderRelease: (_, gesture) => {
			if (gesture.dx <= -SWITCH_DISTANCE) swipeTo(1)
			else if (gesture.dx >= SWITCH_DISTANCE) swipeTo(-1)
		},
	}), [swipeTo])

	if (!enabled) return children
	return (
		<View style={{ flex: 1 }} {...panResponder.panHandlers}>
			{children}
		</View>
	)
}

export const withSwipe = (Screen) => {
	const Wrapped = (props) => (
		<SwipeTabs>
			<Screen {...props} />
		</SwipeTabs>
	)
	Wrapped.displayName = `withSwipe(${Screen.displayName || Screen.name || 'Screen'})`
	return Wrapped
}

export default SwipeTabs
