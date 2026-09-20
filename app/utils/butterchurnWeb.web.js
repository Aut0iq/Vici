import React from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

// Визуализатор в вебе рисуется прямо на странице: butterchurn — веб-библиотека,
// и звук ей можно отдать из того же <audio>, который играет музыку.
// Нативного модуля, как на Android, здесь не нужно

// createMediaElementSource можно вызвать для элемента только один раз за жизнь
// страницы, поэтому звуковой граф держим одним экземпляром на всё приложение
let graph = null

const getGraph = () => {
	if (graph) return graph
	const element = document.getElementById('audio')
	const Context = window.AudioContext || window.webkitAudioContext
	if (!element || !Context) return null

	const context = new Context()
	const source = context.createMediaElementSource(element)
	// Обязательно пускаем звук дальше в динамики: как только элемент попал
	// в граф, его собственный выход отключается, и без этой связи музыка смолкнет
	source.connect(context.destination)
	graph = { context, source }
	return graph
}

const presetNames = () => Object.keys(butterchurnPresets.getPresets())

const pickPreset = (name) => {
	const presets = butterchurnPresets.getPresets()
	if (name && presets[name]) return { name, preset: presets[name] }
	const names = Object.keys(presets)
	const chosen = names[Math.floor(Math.random() * names.length)]
	return { name: chosen, preset: presets[chosen] }
}

// Запускает butterchurn на переданном canvas, пока active === true.
// Возвращает название текущего пресета и способ переключить его
const useButterchurn = (canvasRef, active, initialPreset) => {
	const [presetName, setPresetName] = React.useState('')
	const visualizer = React.useRef(null)
	const frame = React.useRef(null)

	const setPreset = React.useCallback((name) => {
		if (!visualizer.current) return
		const { name: chosen, preset } = pickPreset(name)
		visualizer.current.loadPreset(preset, 2)
		setPresetName(chosen)
	}, [])

	const nextPreset = React.useCallback(() => {
		const names = presetNames()
		const current = names.indexOf(presetName)
		setPreset(names[(current + 1) % names.length])
	}, [presetName, setPreset])

	React.useEffect(() => {
		const canvas = canvasRef.current
		if (!active || !canvas) return

		const audio = getGraph()
		if (!audio) return
		// Браузер запускает звуковой контекст только после действия пользователя,
		// а визуализатор всегда открывают кликом — здесь это безопасно
		audio.context.resume?.().catch(() => { })

		const size = () => ({
			width: Math.max(1, Math.floor(canvas.clientWidth)),
			height: Math.max(1, Math.floor(canvas.clientHeight)),
		})

		const start = size()
		canvas.width = start.width
		canvas.height = start.height

		const created = butterchurn.createVisualizer(audio.context, canvas, {
			...start,
			pixelRatio: window.devicePixelRatio || 1,
		})
		created.connectAudio(audio.source)
		visualizer.current = created

		const { name, preset } = pickPreset(initialPreset)
		created.loadPreset(preset, 0)
		setPresetName(name)

		const render = () => {
			created.render()
			frame.current = window.requestAnimationFrame(render)
		}
		render()

		const observer = new ResizeObserver(() => {
			const next = size()
			canvas.width = next.width
			canvas.height = next.height
			created.setRendererSize(next.width, next.height)
		})
		observer.observe(canvas)

		return () => {
			observer.disconnect()
			if (frame.current) window.cancelAnimationFrame(frame.current)
			frame.current = null
			visualizer.current = null
		}
	}, [active, canvasRef, initialPreset])

	return { presetName, nextPreset }
}

export default useButterchurn
