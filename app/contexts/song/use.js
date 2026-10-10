import React from 'react'
import { SongContext, SongDispatchContext, LiveSongContext, SongFreezeContext } from '~/contexts/song/context'

export const useSong = () => React.useContext(SongContext)
export const useSongDispatch = () => React.useContext(SongDispatchContext)
export const useLiveSong = () => React.useContext(LiveSongContext)
export const useSongFreeze = () => React.useContext(SongFreezeContext)
