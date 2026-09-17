import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '~/contexts/theme'
import GlassView from '~/components/GlassView'
import IconButton from '~/components/button/IconButton'
import size from '~/styles/size'

// Круглая стеклянная кнопка поверх экрана (для темы Vici)
export const GlassCircleButton = ({ icon, onPress, side = 'left', iconSize = 18 }) => {
	const insets = useSafeAreaInsets()
	return (
		<GlassView
			radius={21}
			style={{
				position: 'absolute',
				top: insets.top + 12,
				[side]: (side === 'left' ? insets.left : insets.right) + 16,
				width: 42,
				height: 42,
				zIndex: 2,
			}}
		>
			<IconButton
				icon={icon}
				size={iconSize}
				color="#F6F0E8"
				onPress={onPress}
				style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}
			/>
		</GlassView>
	)
}

const BackButton = () => {
	const navigation = useNavigation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()

	if (theme.glass) return <GlassCircleButton icon="chevron-left" onPress={() => navigation.goBack()} />
	return (
		<IconButton
			style={{
				position: 'absolute',
				top: insets.top,
				left: insets.left,
				padding: 20,
				zIndex: 2,
			}} onPress={() => navigation.goBack()}
			icon="chevron-left"
			size={size.icon.small}
			color="#fff"
		/>
	)
}

export default BackButton