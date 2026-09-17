const { withAndroidManifest } = require('@expo/config-plugins')

// Разрешаем приложению видеть «Режимы и routines» Samsung, чтобы открывать его кнопкой из настроек.
// Без этого блока Android 11+ прячет чужие приложения от нашего.
const PACKAGES = ['com.samsung.android.app.routines']

module.exports = function withAndroidQueries(config) {
	return withAndroidManifest(config, (config) => {
		const manifest = config.modResults.manifest
		if (!manifest.queries) manifest.queries = [{}]
		const queries = manifest.queries[0]
		if (!queries.package) queries.package = []
		for (const name of PACKAGES) {
			if (!queries.package.some((item) => item.$?.['android:name'] === name)) {
				queries.package.push({ $: { 'android:name': name } })
			}
		}
		return config
	})
}
