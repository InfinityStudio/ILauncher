import { Task } from '@xmcl/task'
import { Manager } from '.'
import BaseService from '../service/BaseService'
import CurseForgeService from '../service/CurseForgeService'
import DiagnoseService from '../service/DiagnoseService'
import ExternalAuthSkinService from '../service/ExternalAuthSkinService'
import ImportService from '../service/ImportService'
import InstallService from '../service/InstallService'
import InstanceCurseforgeIOService from '../service/InstanceCurseforgeIOService'
import InstanceGameSettingService from '../service/InstanceGameSettingService'
import InstanceIOService from '../service/InstanceIOService'
import InstanceResourceService from '../service/InstanceResourceService'
import InstanceSavesService from '../service/InstanceSavesService'
import InstanceService from '../service/InstanceService'
import JavaService from '../service/JavaService'
import LaunchService from '../service/LaunchService'
import ResourcePackPreviewService from '../service/ResourcePackPreviewService'
import ResourceService from '../service/ResourceService'
import ServerStatusService from '../service/ServerStatusService'
import UserService from '../service/UserService'
import VersionService from '../service/VersionService'
import { Client } from '/@main/engineBridge'
import AbstractService, { ServiceConstructor } from '/@main/service/Service'
import { JavaServiceKey } from '/@shared/services/JavaService'
import { ServiceKey } from '/@shared/services/Service'
import { aquire, isBusy, release } from '/@shared/util/semaphore'

interface ServiceCallSession {
  id: number
  name: string
  pure: boolean
  call: () => Promise<any>
}

export default class ServiceManager extends Manager {
  private registeredServices: ServiceConstructor[] = []

  private activeServices: AbstractService[] = []

  /**
   * The service exposed to the remote
   */
  private exposedService: Record<string, AbstractService> = {}

  private usedSession = 0

  private sessions: { [key: number]: ServiceCallSession } = {}

  private semaphore: Record<string, number> = {}

  getService<T extends ServiceConstructor>(key: ServiceKey<T>): InstanceType<T> | undefined {
    return this.exposedService[key as any] as any
  }

  protected addService<S extends AbstractService>(type: ServiceConstructor<S>) {
    this.registeredServices.push(type)
  }

  /**
   * Aquire and boradcast the key is in used.
   * @param key The key or keys to aquire
   */
  aquire(key: string | string[]) {
    aquire(this.semaphore, key)
    this.app.broadcast('aquire', key)
  }

  /**
   * Release and boradcast the key is not used.
   * @param key The key or keys to release
   */
  release(key: string | string[]) {
    release(this.semaphore, key)
    this.app.broadcast('release', key)
  }

  /**
   * Determine if a key is in used.
   * @param key key value representing some operation
   */
  isBusy(key: string) {
    return isBusy(this.semaphore, key)
  }

  /**
   * Setup all services.
   */
  setupServices() {
    this.log(`Setup service ${this.app.gameDataPath}`)

    // create service instance
    const serviceMap = this.exposedService
    const injection = this.app.context
    const loaded: Set<ServiceConstructor> = new Set()

    const discoverService = (ServiceConstructor: ServiceConstructor) => {
      if (loaded.has(ServiceConstructor)) {
        throw new Error('Circular Service dependencies!')
      }

      const types = Reflect.getMetadata('design:paramtypes', ServiceConstructor)
      console.log(types)
      console.log(ServiceConstructor)
      const params: any[] = []
      for (const type of types) {
        if (injection.getObject(type)) {
          // inject object
          params.push(injection.getObject(type))
        } else if (Object.getPrototypeOf(type) === AbstractService) {
          // injecting a service
          params.push(discoverService(type))
        } else {
          throw new Error(`Cannot inject type ${type} to service ${type.name}!`)
        }
      }

      const serv = new ServiceConstructor(...params)
      injection.register(ServiceConstructor, serv)
      this.activeServices.push(serv)
      const key = Reflect.getMetadata('service:key', serv)
      if (key) {
        serviceMap[key] = serv
        this.log(`Expose service ${key} to remote`)
      } else {
        this.warn(`Unexpose the service ${ServiceConstructor.name}`)
      }
      return serv
    }

    for (const ServiceConstructor of [...Object.values(this.registeredServices)]) {
      discoverService(ServiceConstructor)
    }
  }

  /**
   * Load all the services
   */
  async initializeServices() {
    const startingTime = Date.now()
    await Promise.all(this.activeServices.map(s => s.initialize().catch((e) => {
      this.error(`Error during initialize service: ${Object.getPrototypeOf(s).constructor.name}`)
      this.error(e)
    })))

    this.log(`Successfully initialize services. Total Time is ${Date.now() - startingTime}ms.`)
  }

  /**
   * Start the specific service call from its id.
   * @param id The service call session id.
   */
  private startServiceCall(id: number) {
    if (!this.sessions[id]) {
      this.error(`Unknown service call session ${id}!`)
    }
    try {
      const r = this.sessions[id].call()
      if (r instanceof Promise) {
        return r.then(r => ({ result: r }), (e) => {
          this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
          this.warn(e)
          this.warn(e.stack)
          return { error: { object: e, errorMessage: e.toString() } }
        })
      }
      return { result: r }
    } catch (e) {
      this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
      this.error(e)
      return { error: e }
    }
  }

  /**
   * Prepare a service call from a client. It will return the service call id.
   *
   * This will start a session in this manager.
   * To exectute this service call session, you shoul call `handleSession`
   *
   * @param client The client calling this service
   * @param service The service name
   * @param name The service function name
   * @param payload The payload
   * @returns The service call session id
   */
  private prepareServiceCall(client: Client, service: string, name: string, payload: any): number | undefined {
    const serv = this.exposedService[service]
    if (!serv) {
      this.error(`Cannot execute service call ${name} from service ${service}. The service not found.`)
    } else {
      if (name in serv) {
        const tasks: Task<any>[] = []
        const sessionId = this.usedSession++
        const taskManager = this.app.taskManager
        const submit = (task: Task<any>) => {
          const promise = taskManager.submit(task)
          client.send(`session-${sessionId}`, (task.context as any).uuid)
          tasks.push(task)
          return promise
        }
        /**
          * Create a proxy to this specific service call to record the tasks it submit
          */
        const servProxy: any = new Proxy(serv, {
          get(target, key) {
            if (key === 'submit') { return submit }
            return Reflect.get(target, key)
          },
        })
        const session: ServiceCallSession = {
          call: () => servProxy[name](payload),
          name: `${service}.${name}`,
          pure: false,
          id: sessionId,
        }

        this.sessions[sessionId] = session

        return sessionId
      }
      this.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`)
    }
    return undefined
  }

  dispose() {
    return Promise.all(this.activeServices.map((s) => s.dispose().catch((e) => {
      this.error(`Error during dispose ${Object.getPrototypeOf(s).constructor.name}:`)
      this.error(e)
    })))
  }

  // SETUP CODE

  async setup() {
    this.setupServices()
    await this.initializeServices()
    this.app.emit('store-ready', this.app.storeManager.store)
    this.addService(BaseService)
    this.addService(CurseForgeService)
    this.addService(DiagnoseService)
    this.addService(ExternalAuthSkinService)
    this.addService(ImportService)
    this.addService(InstallService)
    this.addService(InstanceCurseforgeIOService)
    this.addService(InstanceGameSettingService)
    this.addService(InstanceIOService)
    this.addService(InstanceResourceService)
    this.addService(InstanceSavesService)
    this.addService(InstanceService)
    this.addService(JavaService)
    this.addService(LaunchService)
    this.addService(ResourcePackPreviewService)
    this.addService(ResourceService)
    this.addService(ServerStatusService)
    this.addService(UserService)
    this.addService(VersionService)
  }

  async engineReady() {
    this.app.handle('service-call', (e, service: string, name: string, payload: any) => this.prepareServiceCall(e.sender, service, name, payload))
    this.app.handle('session', (_, id) => this.startServiceCall(id))
  }
}
