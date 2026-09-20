import React from 'react'
import { View, Pressable, Image, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native'
import Text from '~/components/Text'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useCachedAndApi } from '~/utils/api'
import { urlCover } from '~/utils/url'
import { useConfig } from '~/contexts/config'
import { useSong } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import pkg from '~/../package.json'
import size from '~/styles/size'
import mainStyles from '~/styles/main'
import ImageError from '~/components/ImageError'
import AmbientBackground from '~/components/player/AmbientBackground'
import { BlurView } from 'expo-blur'
import { USE_BLUR } from '~/components/GlassView'

const FavoritedItem = ({ navigation, t }) => {
	const theme = useTheme()
	const [isHover, setIsHover] = React.useState(false)

	return (
		<Pressable
			onHoverIn={() => setIsHover(true)}
			onHoverOut={() => setIsHover(false)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				backgroundColor: isHover ? theme.secondaryBack : undefined,
				marginHorizontal: 10,
				paddingVertical: 5,
				paddingHorizontal: 10,
				borderRadius: 8,
			}}
			onPress={async () => {
				await navigation.navigate('PlaylistsStack', { screen: 'Playlists' })
				await navigation.navigate('PlaylistsStack', { screen: 'Favorited' })
			}}
		>
			<View style={{ backgroundColor: '#c68588', width: 40, height: 40, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }}>
				<Icon name="heart" size={size.icon.tiny} color={'#cd1921'} />
			</View>
			<View style={{ flexDirection: 'column', flex: 1 }}>
				<Text
					style={[mainStyles.mediumText(theme.primaryText), {
						fontWeight: '600',
						marginLeft: 10,
					}]}
					numberOfLines={1}
				>{t('Favorited')}</Text>
			</View>
		</Pressable>
	)
}

const PlaylistItem = ({ item, navigation, t }) => {
	const config = useConfig()
	const theme = useTheme()
	const [isHover, setIsHover] = React.useState(false)

	return (
		<Pressable
			onHoverIn={() => setIsHover(true)}
			onHoverOut={() => setIsHover(false)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				backgroundColor: isHover ? theme.secondaryBack : undefined,
				marginHorizontal: 10,
				paddingVertical: 4,
				paddingHorizontal: 10,
				borderRadius: 8,
				marginBottom: 3,
			}}
			onPress={async () => {
				await navigation.navigate('PlaylistsStack', { screen: 'Playlists' })
				await navigation.navigate('PlaylistsStack', { screen: 'Playlist', params: { playlist: item } })
			}}
		>
			<ImageError
				source={{ uri: urlCover(config, item, 100) }}
				style={{ backgroundColor: theme.secondaryBack, width: 40, height: 40, borderRadius: 5 }}
			/>
			<View style={{ flexDirection: 'column', flex: 1 }}>
				<Text
					style={[mainStyles.mediumText(theme.primaryText), {
						fontWeight: '600',
						marginLeft: 10,
					}]}
					numberOfLines={1}
				>
					{item.name}
				</Text>
				<Text style={{ color: theme.secondaryText, fontSize: size.text.small, marginLeft: 10 }} numberOfLines={1}>
					{t('Playlist')}
				</Text>
			</View>
		</Pressable>
	)
}

// Пункт бокового меню. Отдельный компонент, потому что набор вкладок
// меняется в настройках, а хуки внутри map ломались бы при смене их числа
const NavItem = ({ route, index, isFocused, options, navigation, isHover, setHoverIndex }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const disabled = !config.query && route.name !== 'SettingsStack'

	const color = React.useMemo(() => {
		if (isFocused) return theme.primaryTouch
		if (disabled) return theme.secondaryText
		return theme.primaryText
	}, [isFocused, disabled, theme])

	const onPress = () => {
		const event = navigation.emit({
			type: 'tabPress',
			target: route.key,
			canPreventDefault: true,
		})

		if (!isFocused && !event.defaultPrevented) {
			navigation.navigate(route.name, route.params)
		}
	}

	return (
		<Pressable
			onPress={onPress}
			onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
			onHoverIn={() => setHoverIndex(index)}
			onHoverOut={() => setHoverIndex(-1)}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
				flexDirection: 'row',
				alignItems: 'center',
				backgroundColor: (isFocused || isHover) ? theme.secondaryBack : undefined,
				marginHorizontal: 10,
				paddingVertical: 4,
				paddingLeft: 10,
				borderRadius: 8,
				marginBottom: 3,
			}])}
			disabled={disabled}
		>
			<Icon name={options.icon} size={26} color={color} style={{ marginRight: 10 }} />
			<Text style={{ color: color, textAlign: 'left', fontSize: size.text.large, fontWeight: '600' }}>
				{t(options.label)}
			</Text>
		</Pressable>
	)
}

// Обложка того, что играет сейчас — внизу бокового меню, во всю его ширину
const CurrentCover = () => {
	const config = useConfig()
	const theme = useTheme()
	const song = useSong()
	const info = song?.songInfo

	if (!info) return null
	return (
		<View style={styles.cover(theme)}>
			<ImageError
				source={{ uri: urlCover(config, info, 600) }}
				style={{ width: '100%', aspectRatio: 1 }}
			>
				<View style={[styles.coverEmpty(theme), { width: '100%', aspectRatio: 1 }]}>
					<Icon name="music" size={size.icon.large} color={theme.secondaryText} />
				</View>
			</ImageError>
		</View>
	)
}

// Обложка занимает всю ширину колонки, поэтому именно ширина задаёт её размер.
// Содержимому экранов при этом всегда остаётся не меньше 900 точек
const COVER_SIZE = 500
const CONTENT_MIN = 900

const SideBar = ({ state, descriptors, navigation }) => {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const song = useSong()
	const barWidth = Math.max(250, Math.min(COVER_SIZE, width - CONTENT_MIN))
	const config = useConfig()
	const theme = useTheme()
	const [hoverIndex, setHoverIndex] = React.useState(-1)
	const [refresh, setRefresh] = React.useState(0)
	const { t } = useTranslation()

	const [playlists] = useCachedAndApi([], 'getPlaylists', null, (json, setData) => {
		setData(json.playlists.playlist?.filter(playlist => playlist.comment?.includes(`#${config.username}-pin`)) || [])
	}, [refresh])

	return (
		<View style={styles.container(insets, theme, barWidth)}>
			{/* Тот же фон, что и в главном окне: цвета обложки, только темнее и размытее */}
			<AmbientBackground song={song?.songInfo} />
			{USE_BLUR ? <BlurView
				intensity={25}
				tint="dark"
				experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
				style={StyleSheet.absoluteFill}
			/> : null}
			<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.55)' }]} pointerEvents="none" />
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					width: '100%',
					paddingHorizontal: 10,
					paddingTop: 15 + insets.top,
					paddingBottom: 15,
				}}>
				<Image
					source={require('~/../assets/icon.png')}
					style={mainStyles.icon}
				/>
				<View style={{ flexDirection: 'column', justifyContent: 'center' }}>
					<Text style={{ color: theme.primaryText, fontSize: size.text.large, marginBottom: 0 }}>Vici</Text>
					<Text style={{ color: theme.secondaryText, fontSize: size.text.small }}>Version {pkg.version}</Text>
				</View>
			</View>
			{/* Скрытые из меню вкладки остаются в навигаторе ради свайпа, но кнопок им не рисуем */}
			{state.routes
				.map((route, index) => ({ route, index }))
				.filter(({ route }) => descriptors[route.key].options.inBar !== false)
				.map(({ route, index }) => (
					<NavItem
						key={route.key}
						route={route}
						index={index}
						isFocused={state.index === index}
						options={descriptors[route.key].options}
						navigation={navigation}
						isHover={hoverIndex === index}
						setHoverIndex={setHoverIndex}
					/>
				))}

			{
				config.query ?
					<>
						<Pressable
							style={{ marginTop: 16 }}
							onPress={() => setRefresh(refresh + 1)}
						>
							<Text style={[mainStyles.subTitle(theme), { fontSize: 23, marginBottom: 10, marginLeft: 20 }]}>{t('Playlists')}</Text>
						</Pressable>
						<ScrollView
							showsVerticalScrollIndicator={false}
							style={{ flex: 1 }}>
							<FavoritedItem navigation={navigation} t={t} />
							{
								playlists.map((item, index) => (
									<PlaylistItem
										key={index}
										item={item}
										navigation={navigation}
										t={t}
									/>
								))
							}
						</ScrollView>
					</> : null
			}
			<CurrentCover />
		</View>
	)
}

const styles = StyleSheet.create({
	cover: (theme) => ({
		width: '100%',
		aspectRatio: 1,
		flexShrink: 0,
		borderTopWidth: 1,
		borderTopColor: theme.tertiaryBack,
	}),
	coverEmpty: (theme) => ({
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: theme.secondaryBack,
	}),
	container: (insets, theme, barWidth) => ({
		flexDirection: 'column',
		backgroundColor: 'transparent',
		height: '100%',
		maxHeight: '100vh',
		width: barWidth,
		paddingLeft: insets.left,
		paddingRight: insets.right,
		borderEndWidth: 1,
		borderEndColor: theme.tertiaryBack,
	}),
})

export default SideBar