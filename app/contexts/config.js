import AsyncStorage from '@react-native-async-storage/async-storage'
import { initCacheSong } from '~/utils/cache'
import { resetOfflineIndex } from '~/utils/offlineLibrary'
import React from 'react'

const OFFLINE_KEY = 'offlineMode'

const getConfig = async () => {
	const config = await AsyncStorage.getItem('config')
	if (config === null) return { url: null, username: null, query: null }
	return JSON.parse(config)
}

const ConfigContext = React.createContext()
const SetConfigContext = React.createContext()
const OfflineModeContext = React.createContext(false)
const SetOfflineModeContext = React.createContext(() => { })

export const useConfig = () => React.useContext(ConfigContext)
export const useSetConfig = () => React.useContext(SetConfigContext)
export const useOfflineMode = () => React.useContext(OfflineModeContext)
export const useSetOfflineMode = () => React.useContext(SetOfflineModeContext)

export const ConfigProvider = ({ children }) => {
	const [config, setConfig] = React.useState({})
	const [offline, setOffline] = React.useState(false)

	React.useEffect(() => {
		if (config.url) return
		Promise.all([
			getConfig(),
			AsyncStorage.getItem(OFFLINE_KEY).catch(() => null),
		]).then(([data, savedOffline]) => {
			global.offlineMode = savedOffline === 'true'
			setOffline(global.offlineMode)
			setConfig(data)
		})
	}, [])

	React.useEffect(() => {
		if (!config.url) return
		const folderCache = config.url.replace(/[^a-zA-Z0-9]/g, '_')
		global.config = { ...config, folderCache }
		initCacheSong()
		global.songsDownloading = []
	}, [config])

	const changeOffline = React.useCallback((value) => {
		global.offlineMode = value
		resetOfflineIndex()
		setOffline(value)
		AsyncStorage.setItem(OFFLINE_KEY, String(value)).catch(() => { })
	}, [])

	const value = React.useMemo(() => (offline ? { ...config, offline: true } : config), [config, offline])

	return (
		<ConfigContext.Provider value={value}>
			<SetConfigContext.Provider value={setConfig}>
				<OfflineModeContext.Provider value={offline}>
					<SetOfflineModeContext.Provider value={changeOffline}>
						{children}
					</SetOfflineModeContext.Provider>
				</OfflineModeContext.Provider>
			</SetConfigContext.Provider>
		</ConfigContext.Provider>
	)
}
