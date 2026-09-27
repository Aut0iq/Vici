import { getApi } from '~/utils/api'

export const shuffle = (array) => {
	return array.map(value => ({ value, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ value }) => value)
}

const currentRandomIndex = () => {
	return global.song.randomIndex.findIndex((item) => item === global.song.index)
}

export const nextRandomIndex = () => {
	let index = currentRandomIndex()
	if (index === -1) index = 0
	if (index + 1 >= global.song.randomIndex.length) return global.song.randomIndex[0]
	else return global.song.randomIndex[index + 1]
}

export const prevRandomIndex = () => {
	let index = currentRandomIndex()
	if (index - 1 < 0) return global.song.randomIndex[global.song.randomIndex.length - 1]
	else return global.song.randomIndex[index - 1]
}

export const queueWithout = (state, removed) => {
	const queue = state.queue.filter((_, i) => i !== removed)
	const shift = (i) => (i > removed ? i - 1 : i)
	const randomIndex = (state.randomIndex || []).filter((i) => i !== removed).map(shift)

	let index = state.index
	if (removed < state.index) index = state.index - 1
	else if (removed === state.index) {
		const order = state.randomIndex || []
		const position = order.indexOf(removed)
		if (state.actionEndOfSong === 'random' && position !== -1 && order.length > 1) {
			index = shift(order[(position + 1) % order.length])
		} else {
			index = removed < queue.length ? removed : 0
		}
	}
	return { queue, index, randomIndex }
}

export const saveQueue = async (config, queue, index) => {
	if (!global.saveQueue) return
	await getApi(config, 'savePlayQueue', {
		id: queue.map(item => item.id).join(','),
		current: queue[index]?.id || '',
	})
}