import modules from './modules'

export default {
    namespaced: true,
    modules,
    state: () => ({
        id: '',
        name: '',

        resolution: { width: 800, height: 400, fullscreen: false },
        java: '',
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],

        mcversion: '',

        type: 'modpack',
    }),
    getters: {
        id: state => state.id,
        name: state => state.name,
        mcversion: state => state.mcversion,
        java: state => state.java,
        maxMemory: state => state.maxMemory,
        minMemory: state => state.minMemory,
        vmOptions: state => state.vmOptions,
        mcOptions: state => state.mcOptions,
        resolution: state => state.resolution,

        type: state => 'modpack',
    },
    mutations: {
        profile(state, option) {
            Object.keys(option)
                .forEach((key) => { state[key] = option[key] })
        },
    },
    actions: {
        async load(context) {
            const path = `profiles/${context.state.id}`;
            const data = await context.dispatch('read', { path, fallback: {}, type: 'json' }, { root: true });
            context.commit('edit', data);
            for (const m of Object.keys(modules)) {
                await context.dispatch(`${m}/load`, { id: context.state.id });
            }
        },
        save(context) {
            const path = `profiles/${context.state.id}`;
            const data = JSON.stringify(context.state, (key, value) => {
                if (modules[key]) return undefined;
                return value;
            })
            return context.dispatch('writeFile', { path, data }, { root: true });
        },
        edit(context, option) {
            const keys = Object.keys(option);
            if (keys.length === 0) return;
            let changed = false;
            for (const key of keys) {
                if (context.state[key] !== undefined) {
                    if (context.state[key] !== option[key]) {
                        changed = true;
                    }
                }
            }
            if (changed) context.commit('profile', option);
        },
        refresh(context, payload) { },
    },
}
