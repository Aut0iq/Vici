import React from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import Text from '~/components/Text'
import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { getApiNetworkFirst } from '~/utils/api'
import { confirmAlert } from '~/utils/alert'
import { albumStatus, cacheAlbum, removeAlbum, useOffline } from '~/utils/offline'
import { urlCover } from '~/utils/url'
import Header from '~/components/Header'
import ImageError from '~/components/ImageError'
import logger from '~/utils/logger'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const PAGE_SIZE = 100

const AlbumRow = ({ album, status, isBusy, onPress }) => {
	const theme = useTheme()
	const config = useConfig()
	const isComplete = status && status.cached === status.total

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.row])}
		>
			<ImageError
				source={{ uri: urlCover(config, album, 100) }}
				style={[styles.cover, { backgroundColor: theme.secondaryBack }]}
			/>
			<View style={{ flex: 1 }}>
				<Text numberOfLines={1} style={[mainStyles.mediumText(theme.primaryText), { marginBottom: 2 }]}>{album.name || album.title}</Text>
				<Text numberOfLines={1} style={mainStyles.smallText(theme.secondaryText)}>
					{[album.artist, album.songCount].filter(Boolean).join(' · ')}
				</Text>
			</View>
			<View style={styles.status}>
				{status ? (
					<Text style={{ color: isComplete ? theme.primaryTouch : theme.secondaryText, fontSize: size.text.small }}>
						{`${status.cached} / ${status.total}`}
					</Text>
				) : null}
				{isBusy
					? <ActivityIndicator size="small" color={theme.primaryTouch} />
					: <Icon name={isComplete ? 'check-circle' : 'cloud-download'} size={size.icon.small} color={isComplete ? theme.primaryTouch : theme.secondaryText} />}
			</View>
		</Pressable>
	)
}

const OfflineAlbums = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const config = useConfig()
	const offline = useOffline()
	const [albums, setAlbums] = React.useState([])
	const [offset, setOffset] = React.useState(0)
	const [isLoading, setIsLoading] = React.useState(true)

	React.useEffect(() => {
		setIsLoading(true)
		getApiNetworkFirst(config, 'getAlbumList2', { type: 'alphabeticalByName', size: PAGE_SIZE, offset })
			.then((json) => {
				const page = json?.albumList2?.album || []
				if (page.length) setAlbums((current) => [...current, ...page])
			})
			.catch((error) => logger.error('OfflineAlbums', error?.message || error))
			.finally(() => setIsLoading(false))
	}, [offset])

	const press = (album, status) => {
		if (status && status.cached === status.total) {
			confirmAlert(album.name, t('Remove this album from the offline cache?'), () => removeAlbum(config, album.id))
			return
		}
		cacheAlbum(config, album)
			.catch((error) => logger.error('OfflineAlbums', `${album.name}: ${error?.message || error}`))
	}

	const renderItem = ({ item }) => {
		const status = albumStatus(item.id)
		return (
			<AlbumRow
				album={item}
				status={status}
				isBusy={offline.running && Boolean(status) && status.cached < status.total}
				onPress={() => press(item, status)}
			/>
		)
	}

	return (
		<LegendList
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
			data={albums}
			extraData={offline}
			keyExtractor={(item) => item.id}
			renderItem={renderItem}
			estimatedItemSize={80}
			onEndReached={() => {
				if (albums.length && albums.length % PAGE_SIZE === 0) setOffset(albums.length)
			}}
			onEndReachedThreshold={0.5}
			ListHeaderComponent={(
				<>
					<Header title={t('Albums for offline')} />
					<Text style={styles.hint(theme)}>{t('Tap an album to keep it on the phone. Tap a saved album to remove it.')}</Text>
				</>
			)}
			ListFooterComponent={isLoading ? <ActivityIndicator size="small" color={theme.primaryTouch} style={{ margin: 20 }} /> : null}
		/>
	)
}

const styles = StyleSheet.create({
	row: {
		marginHorizontal: 20,
		minHeight: 70,
		marginBottom: 10,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	cover: {
		width: 70,
		height: 70,
		borderRadius: 14,
	},
	status: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingStart: 6,
	},
	hint: (theme) => ({
		marginHorizontal: 20,
		marginBottom: 16,
		color: theme.secondaryText,
		fontSize: size.text.small,
	}),
})

export default OfflineAlbums
