export default {
    namespaced: true,
    state() {
        return {
            mods: [],
            version: '',
            settings: {},
        }
    },
    mutations: {
        version(state, version) { state.version = version },
        update$reload(states, payload) {

        },
    },
    getters: {
        mods: state => state.mods,
        version: state => state.version,
        settings: state => state.settings,
    },
    actions: {
        load() { },
    },
}
