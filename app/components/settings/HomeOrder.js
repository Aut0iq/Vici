import React from 'react'
import { View, PanResponder, Animated, Pressable } from 'react-native'
import Text from '~/components/Text'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useSettings, useSetSettings, homeSections } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import settingStyles from '~/styles/settings'

const ROW_HEIGHT = 50

const HomeRow = ({ value, section, index, isLast, offset, onToggle, onGrab, onDrag, onDrop }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const startMove = React.useRef(0)
	const position = React.useRef(new Animated.Value(0)).current

	const panResponder = React.useMemo(() => PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponder: () => true,
		onPanResponderGrant: (_, gestureState) => {
			startMove.current = gestureState.y0
			position.setValue(0)
			onGrab(index)
		},
		onPanResponderMove: (_, gestureState) => {
			const move = gestureState.moveY - startMove.current
			position.setValue(move)
			onDrag(index + Math.round(move / ROW_HEIGHT))
		},
		onPanResponderRelease: () => {
			const still = position._value === 0
			onDrop(index, Math.round(position._value / ROW_HEIGHT))
			if (still) onToggle(index)
			position.setValue(0)
			startMove.current = 0
		},
	}), [index, onGrab, onDrag, onDrop, onToggle, position])

	const color = value.enable ? theme.primaryTouch : theme.secondaryText

	return (
		<Animated.View
			style={[
				settingStyles.optionItem(theme, isLast),
				{
					cursor: 'pointer',
					transform: [{ translateY: offset === null ? position : offset }],
				},
			]}
		>
			<Pressable
				onPress={() => onToggle(index)}
				style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center' }}
			>
				<View style={{ width: 22, marginEnd: 10, alignItems: 'center' }}>
					<Icon name={section.icon} size={18} color={color} />
				</View>
				<Text style={{ color, flex: 1 }}>{t(`homeSection.${section.title}`)}</Text>
			</Pressable>
			<View
				style={{ height: '100%', justifyContent: 'center', touchAction: 'none' }}
				{...panResponder.panHandlers}
			>
				<Icon name="bars" size={18} color={theme.secondaryText} style={{ marginEnd: 5 }} />
			</View>
		</Animated.View>
	)
}

const HomeOrder = () => {
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [indexMoving, setIndexMoving] = React.useState(-1)
	const [moveToIndex, setMoveToIndex] = React.useState(-1)

	const order = settings.homeOrderV2 || []

	const onToggle = React.useCallback((index) => {
		setSettings({
			...settings,
			homeOrderV2: order.map((item, i) => (i === index ? { ...item, enable: !item.enable } : item)),
		})
	}, [settings, order, setSettings])

	const onGrab = React.useCallback((index) => {
		setIndexMoving(index)
		setMoveToIndex(index)
	}, [])

	const onDrop = React.useCallback((index, direction) => {
		setIndexMoving(-1)
		setMoveToIndex(-1)
		const target = Math.min(Math.max(index + direction, 0), order.length - 1)
		if (target === index) return
		const newOrder = [...order]
		const [moved] = newOrder.splice(index, 1)
		newOrder.splice(target, 0, moved)
		setSettings({ ...settings, homeOrderV2: newOrder })
	}, [settings, order, setSettings])

	const offsetOf = (index) => {
		if (index === indexMoving) return null
		if (indexMoving === -1) return 0
		if (index > indexMoving && index <= moveToIndex) return -ROW_HEIGHT
		if (index < indexMoving && index >= moveToIndex) return ROW_HEIGHT
		return 0
	}

	return (
		<>
			{order.map((value, index) => {
				const section = homeSections.find((item) => item.id === value.id)
				if (!section) return null
				return (
					<HomeRow
						key={value.id}
						value={value}
						section={section}
						index={index}
						isLast={index === order.length - 1}
						offset={offsetOf(index)}
						onToggle={onToggle}
						onGrab={onGrab}
						onDrag={setMoveToIndex}
						onDrop={onDrop}
					/>
				)
			})}
		</>
	)
}

export default HomeOrder
