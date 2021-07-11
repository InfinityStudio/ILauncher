import { Resource } from '../entities/resource.schema'
import { StatefulService, ServiceKey, State } from './Service'
import { AnyResource } from '/@shared/entities/resource'
export interface InstallModsOptions {
  mods: Resource[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path?: string
}

/**
 * The service manage all enable mods in mounted instance
 */
export class InstanceModsState {
  /**
   * The mods under instance folder
   */
  mods = [] as AnyResource[]
  /**
   * The mounted instance
   */
  instance = ''

  instanceModAdd(r: AnyResource[]) {
    this.mods.push(...r)
  }

  instanceModRemove(mods: AnyResource[]) {
    const toRemoved = new Set(mods.map(p => p.hash))
    this.mods = this.mods.filter(m => !toRemoved.has(m.hash))
  }

  instanceMods(payload: { instance: string; resources: AnyResource[] }) {
    this.instance = payload.instance
    this.mods = payload.resources
  }
}

/**
 * Provide the abilities to import/export mods files to instance
 */
export interface InstanceModsService extends StatefulService<InstanceModsState> {
  /**
   * Read all mods under the current instance
   */
  mount(instancePath: string): Promise<void>
  /**
   * Refresh current mounted instance mods. It will reload the mods in state.
   */
  refresh(force?: boolean): Promise<void>
  /**
   * Install certain mods to the instance.
   * @param options The install options
   */
  install(options: InstallModsOptions): Promise<void>
  /**
   * Uninstall certain mods to the instance.
   * @param options The uninstall options
   */
  uninstall(options: InstallModsOptions): Promise<void>
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'