import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'

// Готовим папку с butterchurn и пресетами, чтобы показать их в WebView.
// Файлы копируются один раз и затем берутся из кэша.

const DIR = FileSystem.cacheDirectory + 'butterchurn/'

const FILES = [
	{ name: 'butterchurn.min.js', module: require('~/../assets/butterchurn/butterchurn.min.js.txt') },
	{ name: 'presets.min.js', module: require('~/../assets/butterchurn/presets.min.js.txt') },
	{ name: 'presetsMD1.min.js', module: require('~/../assets/butterchurn/presetsMD1.min.js.txt') },
]

const INDEX = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;background:#0E0A0F;overflow:hidden}
#c{position:absolute;left:50%;top:50%;transform-origin:center center;display:block}
</style>
</head><body>
<canvas id="c"></canvas>
<script src="./butterchurn.min.js"></script>
<script src="./presets.min.js"></script>
<script src="./presetsMD1.min.js"></script>
<script>
const canvas = document.getElementById('c')
const dpr = Math.min(window.devicePixelRatio || 1, 2)
const audioContext = new (window.AudioContext || window.webkitAudioContext)()

const collect = () => {
	const packs = []
	if (window.butterchurnPresets) packs.push(window.butterchurnPresets.getPresets ? window.butterchurnPresets.getPresets() : window.butterchurnPresets)
	if (window.butterchurnPresetsMD1) packs.push(window.butterchurnPresetsMD1.getPresets ? window.butterchurnPresetsMD1.getPresets() : window.butterchurnPresetsMD1)
	return Object.assign({}, ...packs)
}

const presets = collect()
const names = Object.keys(presets)

// Пресеты с полётом сквозь геометрию, разгоном на бит и туннелями — они идут первыми
const preferred = [
	'Eo.S. + Phat - cubetrace - v2',
	'Aderrasi - Contortion (Escher′s Tunnel Mix)',
	'martin - angel flight',
	'Geiss - Spiral Artifact',
	'Flexi, fishbrain, Geiss + Martin - tokamak witchery',
	'flexi + geiss - pogo cubes vs. tokamak vs. game of life [stahls jelly 4.5 finish]',
	'Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)',
	'_Aderrasi - Wanderer in Curved Space - mash0000 - faclempt kibitzing meshuggana schmaltz (Geiss color mix)',
].filter((name) => names.includes(name))

const playlist = preferred.length ? preferred.concat(names.filter((n) => !preferred.includes(n))) : names
let index = 0

// Пресеты MilkDrop рисуются в пропорциях 4:3 и в своём «родном» размере.
// Режимы показа:
//   native  — оригинальный размер, по центру, края уходят за экран (как в Feishin на большом окне)
//   cover   — вписать по ширине с обрезкой сверху и снизу
//   contain — показать целиком, с полями
const ASPECT = 4 / 3
const NATIVE_WIDTH = 1024
let fit = 'native'
let baseW = NATIVE_WIDTH, baseH = Math.round(NATIVE_WIDTH / ASPECT)

const layout = () => {
	const vw = innerWidth, vh = innerHeight
	let k = 1
	if (fit === 'native') {
		baseW = NATIVE_WIDTH
		baseH = Math.round(NATIVE_WIDTH / ASPECT)
		k = 1
	} else if (fit === 'cover') {
		baseW = vw
		baseH = Math.round(vw / ASPECT)
		k = Math.max(vw / baseW, vh / baseH)
	} else {
		baseW = Math.min(vw, Math.round(vh * ASPECT))
		baseH = Math.round(baseW / ASPECT)
		k = Math.min(vw / baseW, vh / baseH)
	}
	canvas.style.width = baseW + 'px'
	canvas.style.height = baseH + 'px'
	canvas.style.transform = 'translate(-50%,-50%) scale(' + k + ')'
	// Ограничиваем буфер рисования, чтобы не терять кадры на телефоне
	const scale = Math.min(dpr, 1600 / baseW)
	const w = Math.floor(baseW * scale)
	const h = Math.floor(baseH * scale)
	// Размер самого холста обязательно держим равным размеру, в котором рисует butterchurn:
	// иначе видно только нижний левый угол картинки, увеличенный во весь экран
	canvas.width = w
	canvas.height = h
	if (visualizer) visualizer.setRendererSize(w, h)
	return { w, h }
}

const first = (() => {
	const scale = Math.min(dpr, 1600 / NATIVE_WIDTH)
	return { w: Math.floor(NATIVE_WIDTH * scale), h: Math.floor(NATIVE_WIDTH / ASPECT * scale) }
})()

canvas.width = first.w
canvas.height = first.h

const visualizer = window.butterchurn.default.createVisualizer(audioContext, canvas, {
	width: first.w,
	height: first.h,
	pixelRatio: 1,
	textureRatio: 1,
})

layout()

const setPreset = (i, blend) => {
	index = (i + playlist.length) % playlist.length
	visualizer.loadPreset(presets[playlist[index]], blend === undefined ? 2 : blend)
	post({ type: 'preset', name: playlist[index], index })
}

const post = (data) => {
	if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data))
}

addEventListener('resize', layout)

// Звук приходит из приложения: система отдаёт волну того, что сейчас играет
const samples = 512
let wave = new Uint8Array(samples).fill(128)

window.vici = (data) => {
	if (data.wave) {
		const source = data.wave
		for (let i = 0; i < samples; i++) wave[i] = source[i % source.length]
	}
	if (data.preset === 'next') setPreset(index + 1)
	if (data.preset === 'prev') setPreset(index - 1)
	if (data.preset === 'random') setPreset(Math.floor(Math.random() * playlist.length))
	// Первый пресет: либо тот, что был выбран в прошлый раз, либо первый в списке
	if (data.presetName !== undefined) startWith(data.presetName)
	if (data.fit) {
		fit = data.fit
		layout()
		post({ type: 'fit', fit })
	}
}

const render = () => {
	visualizer.render({ audioLevels: { timeByteArray: wave, timeByteArrayL: wave, timeByteArrayR: wave } })
	requestAnimationFrame(render)
}

// Не включаем пресет сразу: сначала спрашиваем приложение, какой был выбран в прошлый раз
let started = false
const startWith = (name) => {
	if (started) return
	started = true
	const i = name ? playlist.indexOf(name) : -1
	setPreset(i >= 0 ? i : 0, 0)
}

render()
post({ type: 'ready', count: playlist.length })
setTimeout(() => startWith(null), 800)
</script>
</body></html>`

let prepared = null

export const prepareButterchurn = async () => {
	if (prepared) return prepared
	await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => { })

	for (const file of FILES) {
		const asset = Asset.fromModule(file.module)
		await asset.downloadAsync()
		const target = DIR + file.name
		const info = await FileSystem.getInfoAsync(target)
		if (!info.exists) {
			await FileSystem.copyAsync({ from: asset.localUri || asset.uri, to: target })
		}
	}

	const index = DIR + 'index.html'
	await FileSystem.writeAsStringAsync(index, INDEX)
	prepared = index
	return prepared
}
