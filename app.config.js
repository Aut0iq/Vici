let packageName = "com.aut0iq.vici"
if (process.env.IS_DEV === "true") {
	packageName = "com.aut0iq.vici.dev"
}

module.exports = ({ config }) => {
	return {
		expo: {
			name: "Vici" + (process.env.IS_DEV === "true" ? " (dev)" : ""),
			slug: "vici",
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
				edgeToEdgeEnabled: true,
				permissions: [
					"CHANGE_WIFI_MULTICAST_STATE",
				],
				adaptiveIcon: {
					foregroundImage: "./assets/foreground-icon.png",
					backgroundColor: process.env.IS_DEV === "true" ? "#000000" : "#660000"
				},
				splash: {
					image: "./assets/foreground-icon.png",
					resizeMode: "contain",
					backgroundColor: process.env.IS_DEV === "true" ? "#000000" : "#660000"
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
					"react-native-google-cast",
					{
						androidPlayServicesCastFrameworkVersion: "22.2.0",
					},
				],
			]
		}
	}
}