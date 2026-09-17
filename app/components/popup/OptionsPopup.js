import React from 'react'
import { View, Modal, ScrollView, Animated, Pressable, Platform } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import GlassView from '~/components/GlassView'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const OptionItem = ({ option }) => {
	const theme = useTheme()
	const [isHover, setIsHover] = React.useState(false)
	const settings = useSettings()

	if (!option) return null
	if (option.hidden) return null
	return (
		<Pressable
			onHoverIn={() => settings.isDesktop && setIsHover(true)}
			onHoverOut={() => setIsHover(false)}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 20,
				paddingStart: 20 + 15 * (option.indent || 0),
				height: 45,
				justifyContent: 'flex-start',
				alignContent: 'center',
				gap: 10,
				backgroundColor: isHover ? 'rgba(255,255,255,0.06)' : (theme.glass ? 'transparent' : theme.secondaryBack),
			}])}
			onPress={option.onPress}
		>
			{
				option.icon && (
					<Icon name={option.icon} size={size.icon.tiny} color={theme.glass ? theme.primaryTouch : theme.secondaryText} style={{
						width: 25,
						textAlign: 'center'
					}} />
				)
			}
			{
				option.image && (
					<ImageError
						style={{
							width: 35,
							height: 35,
							borderRadius: option.borderRadius || 10,
						}}
						source={{ uri: option.image }}
					/>
				)
			}
			<Text
				style={{ color: theme.primaryText, fontSize: size.text.large }}
				numberOfLines={1}
			>{option.name}</Text>
		</Pressable>
	)
}

const OptionsPopup = ({ ref, visible, close, options, item = null }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const slide = React.useRef(new Animated.Value(-1000)).current
	const isAnim = React.useRef(false)
	const config = useConfig()
	const navigation = useNavigation()
	const [virtualOptions, setVirtualOptions] = React.useState()

	React.useImperativeHandle(ref, () => ({
		close: close,
		showInfo: (info) => {
			navigation.navigate('Info', { info })
			close()
		},
		setVirtualOptions: (opt) => {
			setVirtualOptions(opt)
		},
		clearVirtualOptions: () => {
			setVirtualOptions(null)
		}
	}), [close])

	React.useEffect(() => {
		if (!visible) slide.setValue(-10000)
		isAnim.current = true
	}, [visible])

	const onLayout = (event) => {
		if (!isAnim.current) return
		isAnim.current = false
		slide.setValue(event.nativeEvent.layout.height)
		Animated.timing(slide, {
			toValue: 0,
			duration: 100,
			useNativeDriver: Platform.OS !== 'web',
		}).start()
	}

	if (!visible) return null
	return (
		<Modal
			transparent={true}
			onRequestClose={close}
			statusBarTranslucent={true}
			visible={visible}>
			<ScrollView
				vertical={true}
				style={{
					width: '100%',
					height: '100%',
					backgroundColor: theme.glass ? 'rgba(8,5,8,0.55)' : 'rgba(0,0,0,0.5)',
				}}
				contentContainerStyle={{
					justifyContent: 'flex-end',
					minHeight: '100%',
				}}
			>
				<Pressable
					onPress={close}
					style={{
						width: '100%',
						minHeight: insets.top + 100,
						flex: 1,
					}}
				/>
				<Animated.View
					onLayout={onLayout}
					style={theme.glass ? {
						// Тема Vici: парящая стеклянная панель со скруглёнными углами
						marginHorizontal: 10,
						marginBottom: (insets.bottom > 10 ? insets.bottom : 10),
						paddingTop: 10,
						paddingBottom: 10,
						backgroundColor: 'rgba(26,18,24,0.94)',
						borderRadius: 28,
						overflow: 'hidden',
						transform: [{ translateY: slide }]
					} : {
						width: "100%",
						paddingTop: 15,
						paddingBottom: insets.bottom > 15 ? insets.bottom : 15,
						backgroundColor: theme.secondaryBack,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						transform: [{ translateY: slide }]
					}}
				>
					{theme.glass ? (
						<>
							<GlassView radius={28} intensity={0.7} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
							<View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(246,240,232,0.3)', marginBottom: 12 }} />
						</>
					) : null}
					{
						item &&
						<View
							style={{
								flexDirection: 'row',
								justifyContent: 'start',
								alignItems: 'center',
								marginHorizontal: 20,
								marginBottom: 10,
								marginTop: 5,
								borderColor: theme.glassLine || theme.secondaryText,
								borderBottomWidth: 1,
								paddingBottom: 15,
							}}
						>
							<ImageError
								style={{
									width: 50,
									height: 50,
									marginRight: 10,
									borderRadius: 12,
								}}
								source={{ uri: urlCover(config, item, 100) }}
							/>
							<View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
								<Text numberOfLines={1} style={mainStyles.mediumText(theme.primaryText)}>
									{item.track !== undefined ? `${item.track}. ` : null}{item.title || item.name}
								</Text>
								{
									(item.artist || item.homePageUrl) ?
										<Text numberOfLines={1} style={mainStyles.smallText(theme.secondaryText)}>
											{item.artist || item.homePageUrl}
										</Text> : null
								}
							</View>
						</View>
					}
					{[...(virtualOptions || options), {
						name: t('Cancel'),
						icon: 'close',
						onPress: close
					}].map((option, index) => (
						<OptionItem key={index} option={option} />
					))}
				</Animated.View>
			</ScrollView>
		</Modal>
	)
}

export default OptionsPopup