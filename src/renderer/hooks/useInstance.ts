import { computed, onMounted, reactive, ref, Ref, toRefs } from '@vue/composition-api';
import { Frame as GameSetting } from '@xmcl/gamesetting';
import { CreateOption, InstanceConfig } from '@universal/store/modules/instance';
import { Resource } from '@universal/store/modules/resource';
import { getExpectVersion } from '@universal/util/version';
import Vue from 'vue';
import { useStore } from './useStore';
import { useCurrentUser } from './useUser';
import { useMinecraftVersions } from './useVersion';
import { useServiceOnly, useService } from './useService';

/**
 * Use the general info of the instance
 */
export function useInstance() {
    const { getters, state } = useStore();
    const instance: InstanceConfig & { [key: string]: unknown } = getters.instance as any;

    const maxMemory = computed(() => instance.maxMemory);
    const minMemory = computed(() => instance.minMemory);
    const author = computed(() => instance.author || '');

    const server = computed(() => instance.server);
    const refreshing = computed(() => state.semaphore.instance > 0);
    const javaPath = computed(() => state.instance.java);

    const refs = toRefs(instance);
    return {
        ...refs,
        author,
        /**
         * min memory
         */
        maxMemory,
        minMemory,
        isServer: computed(() => instance.server !== undefined),
        javaPath,
        server,
        refreshing,

        ...useServiceOnly('InstanceService', 'editInstance', 'setJavaPath', 'refreshServerStatus'),
        ...useServiceOnly('InstanceIOService', 'exportInstance'),
    };
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
    const { getters } = useStore();
    return {
        instances: computed(() => getters.instances),

        ...useServiceOnly('InstanceService', 'mountInstance', 'deleteInstance', 'refreshServerStatusAll'),
        ...useServiceOnly('InstanceIOService', 'importInstance'),
    };
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
    const { name } = useCurrentUser();
    const { createAndSelect } = useService('InstanceService');
    const { release } = useMinecraftVersions();
    const data: CreateOption = reactive({
        name: '',
        runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '' },
        java: '',
        showLog: false,
        hideLauncher: true,
        vmOptions: [],
        mcOptions: [],
        maxMemory: undefined,
        minMemory: undefined,
        author: name.value,
        description: '',
        deployments: { mods: [] },
        resolution: undefined,
        url: '',
        icon: '',
        image: '',
        blur: 4,
        host: '',
        port: -1,
    });
    const serverRef: Ref<Required<CreateOption>['server']> = ref({
        host: '',
        port: undefined,
    });
    const refs = toRefs(data);
    const required: Required<typeof refs> = toRefs(data) as any;
    return {
        ...required,
        server: serverRef,
        /**
         * Commit this creation. It will create and select the instance.
         */
        create() {
            return createAndSelect(data);
        },
        /**
         * Reset the change
         */
        reset() {
            data.name = 'Latest Game';
            data.runtime = {
                minecraft: release.value?.id || '',
                forge: '',
                liteloader: '',
            };
            data.java = '';
            data.showLog = false;
            data.hideLauncher = true;
            data.vmOptions = [];
            data.mcOptions = [];
            data.maxMemory = undefined;
            data.minMemory = undefined;
            data.author = name.value;
            data.description = '';
            data.deployments = { mods: [] };
            data.resolution = undefined;
            data.url = '';
            data.icon = '';
            data.image = '';
            data.blur = 4;
        },
        /**
         * Use the same configuration as the input instance
         * @param instance The instance will be copied
         */
        use(instance: InstanceConfig) {
            data.name = instance.name;
            data.runtime = instance.runtime;
            data.java = instance.java;
            data.showLog = instance.showLog;
            data.hideLauncher = instance.hideLauncher;
            data.vmOptions = instance.vmOptions;
            data.mcOptions = instance.mcOptions;
            data.maxMemory = instance.maxMemory;
            data.minMemory = instance.minMemory;
            data.author = instance.author;
            data.description = instance.description;
            data.url = instance.url;
            data.icon = instance.icon;
            data.image = instance.image;
            data.blur = instance.blur;
            data.server = instance.server;
        },
    };
}

export function useInstanceVersionBase() {
    const { getters } = useStore();
    const profile: InstanceConfig = getters.instance;
    return {
        ...toRefs(profile.runtime),
    };
}

export function useProfileTemplates() {
    const { getters } = useStore();
    return {
        profiles: computed(() => getters.instances),
        modpacks: computed(() => getters.modpacks),
    };
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
    const { state, getters, commit: cm } = useStore();
    const { editInstance } = useService('InstanceService');

    const data = reactive({
        packs: [] as string[],
    });
    /**
     * Unused resources
     */
    const unusedPackResources = computed(() => state.resource.domains.resourcepacks
        .filter(r => r.source.uri.every(i => data.packs.indexOf(i) === -1)));
    /**
     * Used resources
     */
    const usedPackResources = computed(() => data.packs.map(i => state.resource.directory[i]));

    /**
     * Add a new resource to the used list
     */
    function add(res: Resource<any>) {
        data.packs.push(res.source.uri[0]);
    }

    /**
     * Remove a resource from used list
     */
    function remove(index: number) {
        Vue.delete(data.packs, index);
    }

    function swap(from: number, to: number) {
        const last = data.packs[to];
        data.packs[to] = last;
        data.packs[from] = last;
    }

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        cm('instanceGameSettings', { resourcePacks: usedPackResources.value.map(r => r.name + r.ext) });
        editInstance({ deployments: { resourcepacks: data.packs } });
    }

    onMounted(() => {
        data.packs = [...getters.instance.deployments.resourcepacks];
    });

    return {
        unusedPackResources,
        usedPackResources,
        add,
        remove,
        commit,
        swap,
    };
}

export function useInstanceGameSetting() {
    const { state } = useStore();
    const { loadInstanceGameSettings, edit } = useService('InstanceGameSettingService');
    return {
        ...toRefs(state.instance.settings),
        refresh() {
            return loadInstanceGameSettings(state.instance.path);
        },
        commitChange(settings: GameSetting) {
            edit(settings);
        },
    };
}

/**
 * Use references of all the version info of this instance
 */
export function useInstanceVersion() {
    const { getters } = useStore();

    const instance: InstanceConfig = getters.instance;

    const refVersion = toRefs(instance.runtime);
    const folder = computed(() => getters.instanceVersion.folder);
    const id = computed(() => getExpectVersion(
        instance.runtime.minecraft,
        instance.runtime.forge,
        instance.runtime.liteloader,
    ));

    return {
        ...refVersion,
        id,
        folder,
    };
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
    const { state, getters } = useStore();
    const { editInstance } = useService('InstanceService');

    const data = reactive({
        mods: [] as string[],
    });
    /**
     * Unused mod resources
     */
    const unusedModResources = computed(() => state.resource.domains.mods
        .filter(r => r.source.uri.every(i => data.mods.indexOf(i) === -1)));
    /**
     * Used mod resources
     */
    const usedModResources = computed(() => data.mods.map(i => state.resource.directory[i]));

    /**
     * Add a new mod resource to the used list
     */
    function add(res: Resource<any>) {
        data.mods.push(res.source.uri[0]);
    }

    /**
     * Remove a mod resource from used list
     */
    function remove(index: number) {
        Vue.delete(data.mods, index);
    }

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        editInstance({ deployments: { mods: data.mods } });
    }

    onMounted(() => {
        data.mods = [...getters.instance.deployments.mods];
    });

    return {
        unusedModResources,
        usedModResources,
        add,
        remove,
        commit,
    };
}
export function useInstanceSaves() {
    const { state } = useStore();
    return {
        path: computed(() => state.instance.path),
        saves: computed(() => state.instance.saves),
        ...useServiceOnly('InstanceSavesService', 'cloneSave', 'deleteSave', 'exportSave', 'loadAllInstancesSaves', 'importSave'),
    };
}
export function useInstanceLogs() {
    const { state } = useStore();
    return {
        path: computed(() => state.instance.path),
        ...useServiceOnly('InstanceLogService', 'getCrashReportContent', 'getLogContent', 'listCrashReports', 'listLogs', 'removeCrashReport', 'removeLog', 'showCrash', 'showLog'),
    };
}