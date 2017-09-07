import Vue from 'vue'

export default {
    namespaced: true,
    state: {
        modes: ['mojang', 'offline'],
        mode: 'mojang',
        history: {},

        auth: {
            id: '',
            name: '',
            profiles: [],
            accessToken: '',
            clientToken: '',

            skin: { data: undefined, slim: false },
            cape: undefined,
        }, // cached
    },
    getters: {
        modes: state => state.modes,
        disablePassword: state => state.mode === 'offline',
        mode: state => state.mode,
        info: state => state.auth,
        username: state => state.auth.name,
        id: state => state.auth.id,
        skin: state => state.auth.skin,
        cape: state => state.auth.cape,
        history: state => state.history[state.mode],
    },
    mutations: {
        select(state, mode) {
            if (state.modes.indexOf(mode) !== -1) state.mode = mode
        },
        record(state, { // record the state history
            auth,
            account,
        }) {
            state.auth.clientToken = auth.clientToken
            state.auth.accessToken = auth.accessToken
            state.auth.profiles = auth.profiles
            state.auth.id = auth.selectedProfile.id;
            state.auth.name = auth.selectedProfile.name;
            state.auth.skin.data = auth.skin.data;
            state.auth.skin.slim = auth.skin.slim;
            state.auth.cape = auth.cape;
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            const his = state.history[state.mode];
            const idx = his.indexOf(account);
            if (idx === -1) his.push(account)
            else if (idx === 0) return;
            const first = his[0];
            Vue.set(his, 0, account);
            Vue.set(his, idx, first);
        },
        clear(state) {
            state.auth.accessToken = ''
            state.auth.profiles = []
            state.auth.id = '';
            state.auth.name = 'Steve';
            state.auth.skin.data = undefined;
            state.auth.cape = undefined;
        },
    },
    actions: {
        save(context, payload) {
            const { mutation } = payload;
            if (!mutation.endsWith('/record')) return Promise.resolve()
            const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value))
            return context.dispatch('write', { path: 'auth.json', data }, { root: true })
        },
        async load(context, payload) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, encoding: 'json' }, { root: true });
            data.modes = await context.dispatch('query', { service: 'auth', action: 'modes' }, { root: true });
            return data;
        },
        async logout({ commit, dispatch }) {
            commit('clear')
        },
        async login(context, payload) {
            const result = await context.dispatch('query', { service: 'auth', action: 'login', payload }, { root: true })

            try {
                const profile = await context.dispatch('query', {
                    service: 'profile',
                    action: 'fetch',
                    payload: { service: 'mojang', uuid: result.userId, cache: true },
                }, { root: true });
                const skin = profile.textures.textures.SKIN
                if (skin) {
                    result.skin = {
                        data: skin.data,
                        slim: skin.metadata.model === 'slim',
                    }
                }
                if (profile.textures.textures.CAPE) result.cape = profile.textures.textures.CAPE.data;
                return result;
            } catch (e) {
                context.commit('record', {
                    auth: result,
                    account: payload.account,
                });
                return result;
            }
        },
    },
}
