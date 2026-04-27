import { create } from 'zustand'
import type { MeDto, TokenPairDto, UserSettingsDto } from '@momoya/shared'
import { DEFAULT_REPORT_LIST_FILTER, DEFAULT_WITNESS_TAB } from '@momoya/shared'
import { clearAuthStorage, readStorage, StorageKey, writeStorage } from '../services/storage'
import { resetPostFeedsAfterLogout, syncReportListFilterFromUserSettings } from './postFeedStore'

/** 老版本 storage 里缓存的 user 可能没有 settings，读出来后兜底一下。 */
function withDefaultSettings(user: MeDto | null): MeDto | null {
  if (!user) return user
  const fallback: UserSettingsDto = {
    defaultWitnessTab: DEFAULT_WITNESS_TAB,
    defaultReportListFilter: DEFAULT_REPORT_LIST_FILTER,
  }
  return {
    ...user,
    settings: {
      defaultWitnessTab:
        user.settings?.defaultWitnessTab ?? fallback.defaultWitnessTab,
      defaultReportListFilter:
        user.settings?.defaultReportListFilter ?? fallback.defaultReportListFilter,
    },
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: MeDto | null
  /** 启动时是否已经尝试过从 storage 恢复状态。未 hydrate 前不要做跳转决策。 */
  hydrated: boolean

  hydrate: () => void
  setTokens: (tokens: TokenPairDto) => void
  setUser: (user: MeDto) => void
  login: (payload: TokenPairDto & { user: MeDto }) => void
  logout: () => void
  isAuthed: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  hydrate: () => {
    const accessToken = readStorage<string>(StorageKey.AccessToken)
    const refreshToken = readStorage<string>(StorageKey.RefreshToken)
    const user = withDefaultSettings(readStorage<MeDto>(StorageKey.User))
    set({ accessToken, refreshToken, user, hydrated: true })
    syncReportListFilterFromUserSettings(user)
  },

  setTokens: ({ accessToken, refreshToken }) => {
    writeStorage(StorageKey.AccessToken, accessToken)
    writeStorage(StorageKey.RefreshToken, refreshToken)
    set({ accessToken, refreshToken })
  },

  setUser: (user) => {
    const normalized = withDefaultSettings(user)!
    writeStorage(StorageKey.User, normalized)
    set({ user: normalized })
    syncReportListFilterFromUserSettings(normalized)
  },

  login: ({ accessToken, refreshToken, user }) => {
    const normalized = withDefaultSettings(user)!
    writeStorage(StorageKey.AccessToken, accessToken)
    writeStorage(StorageKey.RefreshToken, refreshToken)
    writeStorage(StorageKey.User, normalized)
    set({ accessToken, refreshToken, user: normalized })
    syncReportListFilterFromUserSettings(normalized)
  },

  logout: () => {
    clearAuthStorage()
    resetPostFeedsAfterLogout()
    set({ accessToken: null, refreshToken: null, user: null })
  },

  isAuthed: () => {
    const s = get()
    return !!s.accessToken && !!s.refreshToken
  },
}))
