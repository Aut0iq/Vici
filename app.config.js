let packageName = "com.aut0iq.vici"
if (process.env.IS_DEV === "true") {
	packageName = "com.aut0iq.vici.dev"
}

// Номер сборки Android из версии: 2026.09.17 -> 26091700, 2026.09.17.1 -> 26091701.
// Он растёт с каждой новой версией, поэтому обновления ставятся поверх без проблем
const toVersionCode = (version) => {
	const [y = '', m = '', d = '', build = '0'] = String(version || '').split('.')
	const code = parseInt(`${y.slice(-2)}${m.padStart(2, '0')}${d.padStart(2, '0')}${build.padStart(2, '0')}`, 10)
	return Number.isFinite(code) && code > 0 ? code : 1
}

module.exports = ({ config }) => {
	return {
		expo: {
			name: "Vici" + (process.env.IS_DEV === "true" ? " (dev)" : ""),
			slug: "vici",
			scheme: "vici",
			description: "Vici is a music player for Navidrome and Subsonic API.",
			version: config.version,
			orientation: "default",
			icon: "./assets/icon.png",
			userInterfaceStyle: "light",
			newArchEnabled: false, // Disable New Architecture because react-native-track-player does not support it yet
			assetBundlePatterns: [
				"**/*"
			],
			android: {
				package: packageName,
				versionCode: toVersionCode(config.version),
				edgeToEdgeEnabled: true,
				permissions: [
					"CHANGE_WIFI_MULTICAST_STATE",
				],
				adaptiveIcon: {
					foregroundImage: "./assets/foreground-icon.png",
					backgroundColor: "#0E0A0F"
				},
				splash: {
					image: "./assets/foreground-icon.png",
					resizeMode: "contain",
					backgroundColor: "#0E0A0F"
				}
			},
			web: {
				favicon: "./assets/icon.png",
				shortName: "Vici",
				startUrl: "./index.html",
				backgroundColor: "#121212",
				theme_color: "#121212"
			},
			experiments: {
				baseUrl: process.env.PLATFORM === "web" ? "./" : undefined
			},
			plugins: [
				[
					"expo-build-properties",
					{
						android: {
							usesCleartextTraffic: true
						}
					}
				],
				[
					"react-native-edge-to-edge",
					{
						"android": {
							"parentTheme": "Default",
							"enforceNavigationBarContrast": false
						}
					}
				],
				[
					'./plugins/asyncStorage.js'
				],
				[
					"react-native-android-widget",
					{
						widgets: [
							{
								name: "ViciPlayer",
								label: "Vici",
								description: "Сейчас играет",
								minWidth: "320dp",
								minHeight: "50dp",
								targetCellWidth: 5,
								targetCellHeight: 1,
								maxResizeHeight: "110dp",
								resizeMode: "horizontal|vertical",
								previewImage: "./assets/widget-preview.png",
								updatePeriodMillis: 0,
							},
						],
					},
				],
				[
					"react-native-google-cast",
					{
						androidPlayServicesCastFrameworkVersion: "22.2.0",
					},
				],
			]
		}
	}
}