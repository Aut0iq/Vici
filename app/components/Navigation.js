import React from 'react'
import { View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { HomeStack, SearchStack, MixesStack, PlaylistsStack, SettingsStack } from '~/screens/Stacks'
import { useSettings, tabSections } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import TabBar from '~/components/bar/TabBar'
import QueuePanel from '~/components/bar/QueuePanel'
import useIsDesktop from '~/utils/useIsDesktop'

const Tab = createBottomTabNavigator()

// Какой стек стоит за каждой вкладкой. Название и иконка живут в tabSections
const STACKS = {
	HomeStack,
	SearchStack,
	MixesStack,
	PlaylistsStack,
	SettingsStack,
}

const Navigation = () => {
	const theme = useTheme()
	const settings = useSettings()
	const isDesktop = useIsDesktop()

	// Пользователь сам собирает нижнее меню в «Настройки → Вкладки».
	// В навигатор попадают и вкладки, скрытые из меню, но доступные свайпом
	const tabs = React.useMemo(() => (
		(settings.tabsOrder || [])
			.map((tab) => ({ ...tab, section: tabSections.find((item) => item.id === tab.id) }))
			.filter((tab) => tab.section && STACKS[tab.id] && (tab.enable || tab.swipe))
	), [settings.tabsOrder])

	return (
		<View style={{ flex: 1, flexDirection: 'row', minWidth: 0 }}>
		<View style={{ flex: 1, minWidth: 0 }}>
		<NavigationContainer
			// Тёмный фон навигации: без него при переходах между экранами просвечивает белый
			theme={{
				...DarkTheme,
				colors: {
					...DarkTheme.colors,
					background: theme.primaryBack,
					card: theme.primaryBack,
					primary: theme.primaryTouch,
				},
			}}
			documentTitle={{
				formatter: () => {
					return `Vici`
				}
			}}
		>
			<SystemBars style={theme.barStyle} />
			<Tab.Navigator
				tabBar={(props) => <TabBar {...props} />}
				screenOptions={{
					headerShown: false,
					sceneStyle: { backgroundColor: theme.primaryBack },
					navigationBarColor: theme.primaryBack,
					tabBarPosition: isDesktop ? 'left' : 'bottom',
					tabBarStyle: {
						backgroundColor: theme.secondaryBack,
						borderTopColor: theme.secondaryBack,
						tabBarActiveTintColor: theme.primaryTouch,
					}
				}}
			>
				{tabs.map((tab) => (
					<Tab.Screen
						key={tab.id}
						name={tab.id}
						options={{ label: tab.section.label, icon: tab.section.icon, inBar: tab.enable }}
						component={STACKS[tab.id]}
					/>
				))}
			</Tab.Navigator>
		</NavigationContainer>
		</View>
		{isDesktop ? <QueuePanel /> : null}
		</View>
	)
}

export default Navigation