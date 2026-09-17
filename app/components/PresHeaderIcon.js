import React from 'react'
import { Text, View, StyleSheet } from 'react-native'

import { useTheme } from '~/contexts/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BackButton, { GlassCircleButton } from '~/components/button/BackButton'
import GlassView from '~/components/GlassView'
import Icon from 'react-native-vector-icons/FontAwesome'
import IconButton from '~/components/button/IconButton'
import presStyles from '~/styles/pres'

const PresHeaderIcon = ({ title, subTitle, icon, onPressOption = null, children = null }) => {
	const theme = useTheme()
	const insets = useSafeAreaInsets()

	// Тема Vici: иконка в стеклянном квадрате по центру
	if (theme.glass) return (
		<>
			<BackButton />
			{onPressOption ? <GlassCircleButton icon="ellipsis-h" side="right" onPress={onPressOption} /> : null}
			<View style={{ paddingTop: insets.top + 70, alignItems: 'center' }}>
				<GlassView radius={30} style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
					<Icon name={icon} size={70} color={theme.primaryTouch} />
				</GlassView>
			</View>
			<View style={[presStyles.headerContainer, { marginTop: 10 }]}>
				<View style={{ flex: 1 }}>
					<Text style={presStyles.title(theme)}>{title}</Text>
					<Text style={presStyles.subTitle(theme)}>{subTitle}</Text>
				</View>
				{children}
			</View>
		</>
	)

	return (
		<>
			<BackButton />
			{
				onPressOption ?
					<IconButton
						icon="ellipsis-h"
						onPress={onPressOption}
						color={'white'}
						style={{
							position: 'absolute',
							padding: 20,
							top: insets.top,
							right: insets.left,
							zIndex: 1
						}}
					/> : null
			}
			<View style={styles.cover}>
				<Icon name={icon} size={100} color={'#cd1921'} />
			</View>
			<View style={presStyles.headerContainer}>
				<View style={{ flex: 1 }}>
					<Text style={presStyles.title(theme)}>{title}</Text>
					<Text style={presStyles.subTitle(theme)}>{subTitle}</Text>
				</View>
				{children}
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	cover: {
		width: "100%",
		height: 300,
		flexDirection: 'column',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#c68588',
	},
})

export default PresHeaderIcon