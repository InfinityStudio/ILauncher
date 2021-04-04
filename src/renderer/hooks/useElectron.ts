import { inject } from '@vue/composition-api'
import { Clipboard, Dialog, IpcRenderer } from 'electron'
import { useServiceOnly } from './useService'
import { ELECTRON_CLIPBOARD, IPC_KEY, REMOTE_DIALOG_KEY } from '/@/constant'
import { BaseServiceKey } from '/@shared/services/BaseService'
import { requireNonnull } from '/@shared/util/assert'

/**
 * Use electron native dialog
 */
export function useNativeDialog(): Dialog {
  const dialog = inject(REMOTE_DIALOG_KEY)
  requireNonnull(dialog)
  return dialog
}

/**
 * Use electron ipc renderer
 */
export function useIpc(): IpcRenderer {
  const ipc = inject(IPC_KEY)
  requireNonnull(ipc)
  return ipc as any
}

/**
 * Use electron clipboard
 */
export function useClipboard(): Clipboard {
  const board = inject(ELECTRON_CLIPBOARD)
  requireNonnull(board)
  return board
}

export function useQuit() {
  return useServiceOnly(BaseServiceKey, 'quit', 'exit')
}
