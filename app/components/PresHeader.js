import React from 'react'
import { View, Pressable, useWindowDimensions } from 'react-native'
import Text from '~/components/Text'
import { useTheme } from '~/contexts/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import BackButton, { GlassCircleButton } from '~/components/button/BackButton'
import mainStyles from '~/styles/main'
import presStyles from '~/styles/pres'
import ImageError from '~/components/ImageError'
import IconButton from '~/components/button/IconButton'

const PresHeader = ({ title, subTitle, imgSrc, onPressTitle = null, onPressOption = null, children = null }) => {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()

	// Тема Vici: обложка по центру со скруглением, круглые стеклянные кнопки
	if (theme.glass) {
		const cover = Math.min(Math.round(width * 0.62), 300)
		return (
			<>
				<BackButton />
				{onPressOption ? <GlassCircleButton icon="ellipsis-h" side="right" onPress={onPressOption} /> : null}
				<View style={{ paddingTop: insets.top + 70, alignItems: 'center' }}>
					<ImageError
						style={{ width: cover, height: cover, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.06)' }}
						source={{ uri: imgSrc }}
					/>
				</View>
				<View style={[presStyles.headerContainer, { marginTop: 10 }]}>
					<View style={{ flex: 1 }}>
						<Text style={presStyles.title(theme)} numberOfLines={2}>{title}</Text>
						<Pressable
							style={mainStyles.opacity}
							onPress={onPressTitle}
							disabled={!onPressTitle}
						>
							<Text style={presStyles.subTitle(theme)}>{subTitle}</Text>
						</Pressable>
					</View>
					{children}
				</View>
			</>
		)
	}

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
			<ImageError
				style={[presStyles.cover, { backgroundColor: theme.secondaryBack }]}
				source={{ uri: imgSrc }}
			/>
			<View style={presStyles.headerContainer}>
				<View style={{ flex: 1 }}>
					<Text style={presStyles.title(theme)} numberOfLines={2}>{title}</Text>
					<Pressable
						style={mainStyles.opacity}
						onPress={onPressTitle}
						disabled={!onPressTitle}
					>
						<Text style={presStyles.subTitle(theme)}>{subTitle}</Text>
					</Pressable>
				</View>
				{children}
			</View>
		</>
	)
}

export default PresHeader