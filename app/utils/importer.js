import React from 'react'

import { codaEnqueue, codaSearch } from '~/utils/coda'
import { pickMatch, searchQuery } from '~/utils/importParse'
import logger from '~/utils/logger'

const PARALLEL = 2
const NOTIFY_INTERVAL = 250

export const STATUS = {
	waiting: 'waiting',
	searching: 'searching',
	owned: 'owned',
	queued: 'queued',
	notFound: 'notFound',
	error: 'error',
}

const emptyCounts = () => ({ owned: 0, queued: 0, notFound: 0, error: 0 })

let state = { running: false, fileName: '', items: [], done: 0, counts: emptyCounts(), error: null }
let generation = 0
let next = 0
let notifyTimer = null
const enqueued = new Set()
const listeners = new Set()

const notify = () => {
	if (notifyTimer) return
	notifyTimer = setTimeout(() => {
		notifyTimer = null
		listeners.forEach((listener) => listener())
	}, NOTIFY_INTERVAL)
}

const update = (index, patch) => {
	const items = [...state.items]
	items[index] = { ...items[index], ...patch }
	state = { ...state, items }
	if (patch.status && ![STATUS.searching, STATUS.waiting].includes(patch.status)) {
		state = { ...state, done: state.done + 1, counts: { ...state.counts, [patch.status]: state.counts[patch.status] + 1 } }
	}
	notify()
}

const find = async (coda, track) => {
	const first = await codaSearch(coda, searchQuery(track, true))
	const match = pickMatch(track, first.tracks)
	if (match || !track.artists.length) return match
	const second = await codaSearch(coda, searchQuery(track, false))
	return pickMatch(track, second.tracks)
}

const handle = async (coda, index, job) => {
	const track = state.items[index]
	update(index, { status: STATUS.searching })
	try {
		const match = await find(coda, track)
		if (job !== generation) return
		if (!match) return update(index, { status: STATUS.notFound })
		const found = { title: match.title, artist: match.artist }
		if (match.owned) return update(index, { status: STATUS.owned, found })
		if (!enqueued.has(match.id)) {
			enqueued.add(match.id)
			await codaEnqueue(coda, { track_id: match.id })
		}
		if (job !== generation) return
		update(index, { status: STATUS.queued, found })
	} catch (error) {
		if (job !== generation) return
		update(index, { status: STATUS.error })
		logger.warn('Import', `${track.artists.join(', ')} - ${track.title}: ${error?.message || error}`)
		if (['auth', 'outdated', 'network'].includes(error?.code)) stopImport(error.code)
	}
}

const work = async (coda, job) => {
	while (job === generation && next < state.items.length) {
		const index = next
		next += 1
		await handle(coda, index, job)
	}
	if (job === generation && state.running && state.done >= state.items.length) {
		state = { ...state, running: false }
		logger.info('Import', `${state.fileName}: queued ${state.counts.queued}, on server ${state.counts.owned}, not found ${state.counts.notFound}, errors ${state.counts.error}`)
		notify()
	}
}

export const startImport = (coda, tracks, fileName) => {
	generation += 1
	next = 0
	state = {
		running: true,
		fileName,
		items: tracks.map((track) => ({ ...track, status: STATUS.waiting })),
		done: 0,
		counts: emptyCounts(),
		error: null,
	}
	notify()
	for (let i = 0; i < PARALLEL; i++) work(coda, generation)
}

export const stopImport = (error = null) => {
	generation += 1
	const items = state.items.map((item) => ([STATUS.waiting, STATUS.searching].includes(item.status) ? { ...item, status: STATUS.waiting } : item))
	state = { ...state, running: false, items, error }
	notify()
}

export const useImport = () => {
	const [, refresh] = React.useReducer((count) => count + 1, 0)

	React.useEffect(() => {
		listeners.add(refresh)
		return () => listeners.delete(refresh)
	}, [])

	return state
}
