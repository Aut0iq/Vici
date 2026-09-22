import React from 'react'
import { View, Pressable, FlatList, StyleSheet, Platform } from 'react-native'
import Text from '~/components/Text'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { QUEUE_WIDTH } from '~/utils/useIsDesktop'
import ImageError from '~/components/ImageError'
import AmbientBackground from '~/components/player/AmbientBackground'
import { BlurView } from 'expo-blur'
import { USE_BLUR } from '~/components/GlassView'
import IconButton from '~/components/button/IconButton'
import Player from '~/utils/player'
import size from '~/styles/size'

const QueueItem = ({ item, index, isCurrent, onPress }) => {
	const config = useConfig()
	const theme = useTheme()
	const [isHover, setIsHover] = React.useState(false)
	const color = isCurrent ? theme.primaryTouch : theme.primaryText

	return (
		<Pressable
			onPress={onPress}
			onHoverIn={() => setIsHover(true)}
			onHoverOut={() => setIsHover(false)}
			style={[styles.item, { backgroundColor: (isHover && !isCurrent) ? theme.secondaryBack : undefined }]}
		>
			<View style={styles.number}>
				{isCurrent
					? <Icon name="volume-up" size={13} color={theme.primaryTouch} />
					: <Text style={{ color: theme.secondaryText, fontSize: size.text.small }}>{index + 1}</Text>}
			</View>
			<ImageError source={{ uri: urlCover(config, item, 100) }} style={styles.cover}>
				<View style={[styles.cover, styles.coverEmpty(theme)]}>
					<Icon name="music" size={13} color={theme.secondaryText} />
				</View>
			</ImageError>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text numberOfLines={1} style={{ color, fontWeight: isCurrent ? 'bold' : 'normal' }}>{item?.title || ''}</Text>
				<Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: size.text.small }}>{item?.artist || ''}</Text>
			</View>
			<Text style={{ color: theme.secondaryText, fontSize: size.text.small }}>{Player.secondToTime(item?.duration || 0)}</Text>
		</Pressable>
	)
}

// Очередь воспроизведения — колонка справа, как в настольных плеерах.
// Показывается только в широком окне, на телефоне очередь открывается из плеера
const QueuePanel = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const song = useSong()
	const songDispatch = useSongDispatch()
	const scroll = React.useRef(null)
	const queue = song?.queue || []

	// Держим играющий трек в поле зрения, не мешая листать вручную
	React.useEffect(() => {
		if (song?.index === undefined || song?.index < 0) return
		const offset = Math.max(0, (song.index - 3) * ITEM_HEIGHT)
		scroll.current?.scrollToOffset({ offset, animated: true })
	}, [song?.index])

	if (!queue.length) return null
	return (
		<View style={styles.container(insets, theme)}>
			{/* Тот же фон, что и в главном окне: цвета обложки, только темнее и размытее */}
			<AmbientBackground song={song?.songInfo} />
			{USE_BLUR ? <BlurView
				intensity={25}
				tint="dark"
				experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
				style={StyleSheet.absoluteFill}
			/> : null}
			<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.55)' }]} pointerEvents="none" />
			<View style={styles.header(theme)}>
				<Text numberOfLines={1} style={{ color: theme.primaryText, fontSize: size.text.medium, fontWeight: 'bold', flex: 1 }}>
					{t('Queue')}
				</Text>
				<Text style={{ color: theme.secondaryText, fontSize: size.text.small, marginEnd: 10 }}>
					{`${(song?.index ?? 0) + 1} / ${queue.length}`}
				</Text>
				<IconButton
					icon="random"
					size={16}
					color={song?.actionEndOfSong === 'random' ? theme.primaryTouch : theme.secondaryText}
					style={{ padding: 6 }}
					onPress={() => Player.setRepeat(songDispatch, song?.actionEndOfSong === 'random' ? 'next' : 'random')}
				/>
			</View>
			{/* Список виртуальный: строки и их обложки грузятся только для видимой части.
			    На медленной сети полсотни обложек разом тормозили всё остальное */}
			<FlatList
				ref={scroll}
				data={queue}
				extraData={song?.index}
				keyExtractor={(item, index) => `${item?.id || 'song'}-${index}`}
				getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
				initialNumToRender={15}
				windowSize={5}
				showsVerticalScrollIndicator={false}
				style={{ flex: 1 }}
				renderItem={({ item, index }) => (
					<QueueItem
						item={item}
						index={index}
						isCurrent={index === song?.index}
						onPress={() => Player.setIndex(config, songDispatch, queue, index)}
					/>
				)}
			/>
		</View>
	)
}

// Высота строки нужна, чтобы отлистывать очередь к играющему треку
const ITEM_HEIGHT = 56

const styles = StyleSheet.create({
	container: (insets, theme) => ({
		width: QUEUE_WIDTH,
		height: '100%',
		paddingTop: insets.top,
		backgroundColor: 'transparent',
		borderStartWidth: 1,
		borderStartColor: theme.tertiaryBack,
	}),
	header: (theme) => ({
		flexDirection: 'row',
		alignItems: 'center',
		paddingLeft: 16,
		paddingRight: 6,
		height: 52,
		borderBottomWidth: 1,
		borderBottomColor: theme.tertiaryBack,
	}),
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		height: ITEM_HEIGHT,
		paddingHorizontal: 10,
		gap: 10,
	},
	number: {
		width: 22,
		alignItems: 'center',
	},
	cover: {
		width: 38,
		height: 38,
		borderRadius: 4,
	},
	coverEmpty: (theme) => ({
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: theme.secondaryBack,
	}),
})

export default QueuePanel
