import React from 'react'
import { View, PanResponder, Animated, Pressable } from 'react-native'
import Text from '~/components/Text'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useSettings, useSetSettings, tabSections } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import settingStyles from '~/styles/settings'

// Высота строки: по ней же считаем, на сколько позиций утащили вкладку
const ROW_HEIGHT = 50

const TabRow = ({ tab, section, index, isLast, offset, onToggle, onToggleSwipe, onGrab, onDrag, onDrop }) => {
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
			onDrop(index, Math.round(position._value / ROW_HEIGHT))
			position.setValue(0)
			startMove.current = 0
		},
	}), [index, onGrab, onDrag, onDrop, position])

	const color = tab.enable ? theme.primaryTouch : theme.secondaryText

	return (
		<Animated.View
			style={[
				settingStyles.optionItem(theme, isLast),
				{
					cursor: 'pointer',
					// Пока тащим эту строку — двигаем её саму, соседние уезжают на offset
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
				<Text style={{ color, flex: 1 }}>{t(section.label)}</Text>
			</Pressable>
			{/* Второй переключатель: попадает ли вкладка в переключение свайпом */}
			<Pressable
				onPress={() => onToggleSwipe(index)}
				disabled={section.lockSwipe}
				style={{ height: '100%', justifyContent: 'center', paddingHorizontal: 10 }}
			>
				<Icon
					name={section.lockSwipe ? 'lock' : 'arrows-h'}
					size={18}
					color={tab.swipe ? theme.primaryTouch : theme.secondaryText}
				/>
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

// Список вкладок нижнего меню: нажатие на название показывает и прячет вкладку,
// значок со стрелками — переключение свайпом, «гамбургер» справа перетаскивает
const TabsOrder = () => {
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [indexMoving, setIndexMoving] = React.useState(-1)
	const [moveToIndex, setMoveToIndex] = React.useState(-1)

	const tabs = settings.tabsOrder || []

	const update = React.useCallback((index, changes) => {
		setSettings({
			...settings,
			tabsOrder: tabs.map((tab, i) => (i === index ? { ...tab, ...changes } : tab)),
		})
	}, [settings, tabs, setSettings])

	const onToggle = React.useCallback((index) => {
		update(index, { enable: !tabs[index].enable })
	}, [tabs, update])

	const onToggleSwipe = React.useCallback((index) => {
		update(index, { swipe: !tabs[index].swipe })
	}, [tabs, update])

	const onGrab = React.useCallback((index) => {
		setIndexMoving(index)
		setMoveToIndex(index)
	}, [])

	const onDrop = React.useCallback((index, direction) => {
		setIndexMoving(-1)
		setMoveToIndex(-1)
		const target = Math.min(Math.max(index + direction, 0), tabs.length - 1)
		if (target === index) return
		const newOrder = [...tabs]
		const [moved] = newOrder.splice(index, 1)
		newOrder.splice(target, 0, moved)
		setSettings({ ...settings, tabsOrder: newOrder })
	}, [settings, tabs, setSettings])

	// Насколько сдвинуть строку, пока тащат соседнюю. null — это сама перетаскиваемая строка
	const offsetOf = (index) => {
		if (index === indexMoving) return null
		if (indexMoving === -1) return 0
		if (index > indexMoving && index <= moveToIndex) return -ROW_HEIGHT
		if (index < indexMoving && index >= moveToIndex) return ROW_HEIGHT
		return 0
	}

	return (
		<>
			{tabs.map((tab, index) => {
				const section = tabSections.find((item) => item.id === tab.id)
				if (!section) return null
				return (
					<TabRow
						key={tab.id}
						tab={tab}
						section={section}
						index={index}
						isLast={index === tabs.length - 1}
						offset={offsetOf(index)}
						onToggle={onToggle}
						onToggleSwipe={onToggleSwipe}
						onGrab={onGrab}
						onDrag={setMoveToIndex}
						onDrop={onDrop}
					/>
				)
			})}
		</>
	)
}

export default TabsOrder
