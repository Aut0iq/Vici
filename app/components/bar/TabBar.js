import React from 'react'

import { useConfig } from '~/contexts/config'
import useIsDesktop from '~/utils/useIsDesktop'
import Player from '~/components/player/Player'
import BottomBar from '~/components/bar/BottomBar'
import SideBar from '~/components/bar/SideBar'

const TabBar = ({ state, descriptors, navigation }) => {
	const config = useConfig()
	const isDesktop = useIsDesktop()

	React.useEffect(() => {
		if (config.query === null) {
			navigation.navigate('SettingsStack')
		}
	}, [config.query])

	return (
		<>
			{
				isDesktop ?
					<SideBar state={state} descriptors={descriptors} navigation={navigation} />
					: <BottomBar state={state} descriptors={descriptors} navigation={navigation} />
			}
			<Player state={state} />
		</>
	)
}

export default TabBar