import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import Home from '~/screens/tabs/Home'
import Playlists from '~/screens/tabs/Playlists'
import Mixes from '~/screens/tabs/Mixes'
import Search from '~/screens/tabs/Search'
import Settings from '~/screens/tabs/Settings'

import Album from '~/screens/Pres/Album'
import Artist from '~/screens/Pres/Artist'
import ArtistAlbums from '~/screens/Pres/ArtistAlbums'
import Favorited from '~/screens/Pres/Favorited'
import Genre from '~/screens/Pres/Genre'
import GenreAlbum from '~/screens/Pres/GenreAlbum'
import GenreSong from '~/screens/Pres/GenreSong'
import Playlist from '~/screens/Pres/Playlist'
import Songs from '~/screens/Pres/Songs'

import EditPlaylist from '~/screens/EditPlaylist'
import UpdateRadio from '~/screens/UpdateRadio'

import AlbumExplorer from '~/screens/Explorer/AlbumExplorer'
import ArtistExplorer from '~/screens/Explorer/ArtistExplorer'
import SongExplorer from '~/screens/Explorer/SongExplorer'
import FreshReleases from '~/screens/FreshReleases'
import Info from '~/screens/Info'
import ShowAll from '~/screens/ShowAll'

import SearchMore from '~/screens/SearchMore'

import AddServer from '~/screens/Settings/AddServer'
import CacheSettings from '~/screens/Settings/Cache'
import Connect from '~/screens/Settings/Connect'
import HomeSettings from '~/screens/Settings/Home'
import InformationsSettings from '~/screens/Settings/Informations'
import LanguageSettings from '~/screens/Settings/Language'
import LogsSettings from '~/screens/Settings/Logs'
import PlayerSettings from '~/screens/Settings/Player'
import PlaylistsSettings from '~/screens/Settings/Playlists'
import SharesSettings from '~/screens/Settings/Shares'
import ThemeSettings from '~/screens/Settings/Theme'

import { useTheme } from '~/contexts/theme'
import { withBackground } from '~/components/ScreenBackground'

// Внутренние экраны получают фон Vici (цвета текущего трека)
const bg = Object.fromEntries(Object.entries({
	AddServer,
	Album,
	AlbumExplorer,
	Artist,
	ArtistAlbums,
	ArtistExplorer,
	CacheSettings,
	Connect,
	EditPlaylist,
	Favorited,
	FreshReleases,
	Genre,
	GenreAlbum,
	GenreSong,
	HomeSettings,
	Info,
	InformationsSettings,
	LanguageSettings,
	LogsSettings,
	PlayerSettings,
	Playlist,
	PlaylistsSettings,
	SearchMore,
	SharesSettings,
	ShowAll,
	SongExplorer,
	Songs,
	ThemeSettings,
	UpdateRadio,
}).map(([name, Screen]) => [name, withBackground(Screen)]))

const Stack = createNativeStackNavigator()

export const HomeStack = () => {
	const theme = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: theme.primaryBack },
				animation: 'none',
				tabBarStyle: {
					backgroundColor: theme.secondaryBack,
					borderTopColor: theme.secondaryBack,
					tabBarActiveTintColor: theme.primaryTouch,
				}
			}}
		>
			<Stack.Screen name="Home" component={Home} />
			<Stack.Screen name="ShowAll" component={bg.ShowAll} />
			<Stack.Screen name="FreshReleases" component={bg.FreshReleases} />
			<Stack.Screen name="UpdateRadio" component={bg.UpdateRadio} />
			{/* Pres */}
			<Stack.Screen name="Album" component={bg.Album} />
			<Stack.Screen name="Artist" component={bg.Artist} />
			<Stack.Screen name="ArtistAlbums" component={bg.ArtistAlbums} />
			<Stack.Screen name="EditPlaylist" component={bg.EditPlaylist} />
			<Stack.Screen name="Genre" component={bg.Genre} />
			<Stack.Screen name="GenreAlbum" component={bg.GenreAlbum} />
			<Stack.Screen name="GenreSong" component={bg.GenreSong} />
			<Stack.Screen name="Info" component={bg.Info} />
			<Stack.Screen name="Playlist" component={bg.Playlist} />
			<Stack.Screen name="Songs" component={bg.Songs} />
		</Stack.Navigator>
	)
}

export const SearchStack = () => {
	const theme = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: theme.primaryBack },
				animation: 'none',
				tabBarStyle: {
					backgroundColor: theme.secondaryBack,
					borderTopColor: theme.secondaryBack,
					tabBarActiveTintColor: theme.primaryTouch,
				}
			}}
		>
			<Stack.Screen name="Search" component={Search} />
			<Stack.Screen name="SearchMore" component={bg.SearchMore} />
			<Stack.Screen name="AlbumExplorer" component={bg.AlbumExplorer} />
			<Stack.Screen name="ArtistExplorer" component={bg.ArtistExplorer} />
			<Stack.Screen name="SongExplorer" component={bg.SongExplorer} />
			{/* Pres */}
			<Stack.Screen name="Album" component={bg.Album} />
			<Stack.Screen name="Artist" component={bg.Artist} />
			<Stack.Screen name="ArtistAlbums" component={bg.ArtistAlbums} />
			<Stack.Screen name="Genre" component={bg.Genre} />
			<Stack.Screen name="GenreAlbum" component={bg.GenreAlbum} />
			<Stack.Screen name="GenreSong" component={bg.GenreSong} />
			<Stack.Screen name="Info" component={bg.Info} />
			<Stack.Screen name="Songs" component={bg.Songs} />
		</Stack.Navigator>
	)
}

export const MixesStack = () => {
	const theme = useTheme()

	return (
		<Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.primaryBack }, animation: 'none' }}>
			<Stack.Screen name="Mixes" component={Mixes} />
			<Stack.Screen name="Playlist" component={bg.Playlist} />
			<Stack.Screen name="EditPlaylist" component={bg.EditPlaylist} />
			<Stack.Screen name="Album" component={bg.Album} />
			<Stack.Screen name="Artist" component={bg.Artist} />
			<Stack.Screen name="ArtistAlbums" component={bg.ArtistAlbums} />
			<Stack.Screen name="Genre" component={bg.Genre} />
			<Stack.Screen name="GenreAlbum" component={bg.GenreAlbum} />
			<Stack.Screen name="GenreSong" component={bg.GenreSong} />
			<Stack.Screen name="Info" component={bg.Info} />
			<Stack.Screen name="Songs" component={bg.Songs} />
		</Stack.Navigator>
	)
}

export const PlaylistsStack = () => {
	const theme = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: theme.primaryBack },
				animation: 'none',
				tabBarStyle: {
					backgroundColor: theme.secondaryBack,
					borderTopColor: theme.secondaryBack,
					tabBarActiveTintColor: theme.primaryTouch,
				}
			}}
		>
			<Stack.Screen name="Playlists" component={Playlists} />
			<Stack.Screen name="Favorited" component={bg.Favorited} />
			{/* Pres */}
			<Stack.Screen name="Album" component={bg.Album} />
			<Stack.Screen name="Artist" component={bg.Artist} />
			<Stack.Screen name="ArtistAlbums" component={bg.ArtistAlbums} />
			<Stack.Screen name="EditPlaylist" component={bg.EditPlaylist} />
			<Stack.Screen name="Genre" component={bg.Genre} />
			<Stack.Screen name="GenreAlbum" component={bg.GenreAlbum} />
			<Stack.Screen name="GenreSong" component={bg.GenreSong} />
			<Stack.Screen name="Info" component={bg.Info} />
			<Stack.Screen name="Playlist" component={bg.Playlist} />
			<Stack.Screen name="Songs" component={bg.Songs} />
		</Stack.Navigator>
	)
}

export const SettingsStack = () => {
	const theme = useTheme()

	return (
		<Stack.Navigator
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: theme.primaryBack },
				animation: 'none',
				tabBarStyle: {
					backgroundColor: theme.secondaryBack,
					borderTopColor: theme.secondaryBack,
					tabBarActiveTintColor: theme.primaryTouch,
				}
			}}
		>
			<Stack.Screen name="Settings" component={Settings} />
			<Stack.Screen name="Connect" component={bg.Connect} />
			<Stack.Screen name="Settings/AddServer" component={bg.AddServer} />
			<Stack.Screen name="Settings/Home" component={bg.HomeSettings} />
			<Stack.Screen name="Settings/Playlists" component={bg.PlaylistsSettings} />
			<Stack.Screen name="Settings/Cache" component={bg.CacheSettings} />
			<Stack.Screen name="Settings/Theme" component={bg.ThemeSettings} />
			<Stack.Screen name="Settings/Informations" component={bg.InformationsSettings} />
			<Stack.Screen name="Settings/Player" component={bg.PlayerSettings} />
			<Stack.Screen name="Settings/Shares" component={bg.SharesSettings} />
			<Stack.Screen name="Settings/Language" component={bg.LanguageSettings} />
			<Stack.Screen name="Settings/Logs" component={bg.LogsSettings} />
		</Stack.Navigator>
	)
}