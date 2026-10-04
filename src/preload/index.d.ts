import type { RiftApi } from '../shared/api'

declare global {
  interface Window {
    api: RiftApi
  }
}

export {}
