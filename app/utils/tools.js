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

export const neighborTracks = (song, ahead = 2, behind = 1) => {
	const queue = song?.queue
	if (!queue?.length || queue.length < 2) return []
	const isRandom = song.actionEndOfSong === 'random' && song.randomIndex?.length === queue.length
	const order = isRandom ? song.randomIndex : queue.map((_, i) => i)
	const place = order.indexOf(song.index)
	if (place === -1) return []
	const picked = new Set()
	for (let step = -behind; step <= ahead; step++) {
		if (step) picked.add(order[(place + step + order.length * 2) % order.length])
	}
	picked.delete(song.index)
	return [...picked].map((i) => queue[i]).filter(Boolean)
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