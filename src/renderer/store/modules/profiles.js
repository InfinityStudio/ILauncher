import uuid from 'uuid'
import { ActionContext } from 'vuex'
import { GameSetting } from 'ts-minecraft'
import server from './profiles/server'
import modpack from './profiles/modpack'

const PROFILE_NAME = 'profile.json'
const PROFILES_NAEM = 'profiles.json'

function regulize(content) {
    content.resourcepacks = content.resourcepacks || []
    content.resolution = content.resolution || { width: 800, height: 400 }
    content.mods = content.mods || []
    content.vmOptions = content.vmOptions || []
    content.mcOptions = content.mcOptions || []
    return content
}

export default {
    namespaced: true,
    state() {
        return {
            /**
             * @type {Profile[]}
             */
            all: [],
            selected: '',
        }
    },
    getters: {
        selected: state => state[state.selected],
        allStates: state => state.all.map(mName => state[mName]),
        getByKey: state => id => state[id],
        selectedKey: state => state.selected,
        allKeys: state => state.all,
        errors(states, getters) {
            if (getters.selectedKey !== '') {
                const get = getters[`${getters.selectedKey}/errors`]
                if (get) return get
            }
            return []
        },
    },
    mutations: {
        unselect(state) {
            state.selected = ''
        },
        select(state, moduleID) {
            const idx = state.all.indexOf(moduleID);
            if (idx !== -1) state.selected = moduleID;
        },
        add(state, payload) {
            state.all.push(payload.id)
        },
        remove(state, id) {
            if (state.all.indexOf(id) !== -1) {
                if (state.selected === id) {
                    state.selected = state.all[0]
                }
                state.all = state.all.filter(v => v !== id)
            }
            if (state.selected === id) state.selected = '';
        },
    },
    actions: {
        loadProfile(context, id) {
            return context.dispatch('read', {
                path: `profiles/${id}/${PROFILE_NAME}`,
                fallback: {},
                encoding: 'json',
            }, { root: true })
                .then(regulize)
                .then(profile => context.commit('add', { id, moduleData: profile }))
        },
        load({ dispatch, commit }, payload) {
            return dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files => Promise.all(files.map(id => dispatch('loadProfile', id))))
                .then(() => dispatch('read', { path: 'profiles.json', fallback: {}, encoding: 'json' }, { root: true }))
                .then(json => commit('select', json.selected))
        },
        async saveProfile(context, { id }) {
            const profileJson = `profiles/${id}/profile.json`
            const data = await context.dispatch(`${id}/serialize`)
            return context.dispatch('write', { path: profileJson, data }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         * @param {{mutation:string, object:any}} payload 
         */
        save(context, payload) {
            const { mutation, object } = payload
            const path = mutation.split('/')
            if (path.length === 2) {
                const [, action] = path
                if (action === 'select') {
                    return context.dispatch('write', {
                        path: PROFILES_NAEM, data: { selected: context.state.selected },
                    }, { root: true })
                }
                return Promise.resolve();
            } else if (path.length === 3) { // only profile
                return context.dispatch('saveProfile', { id: path[1] })
            } else if (path.length === 4) { // save module data
                const target = path[2]
                return Promise.all([
                    context.dispatch('saveProfile', { id: path[1] }),
                    context.dispatch(`${path[1]}/${target}/save`, { id: path[1] }),
                ])
            }
            return context.dispatch('saveProfile', { id: path[1] })
        },
        /**
         * @param {ActionContext} context 
         * @param {CreateOption} payload 
         * @return {Promise<string>}
         */
        create(context, payload) {
            const {
                type,
                option = {},
            } = payload
            const id = uuid()
            option.java = option.java || context.rootGetters.defaultJava
            context.commit('add', { id, moduleData: option })
            return context.dispatch('saveProfile', { id })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} payload 
         */
        delete(context, payload) {
            context.commit('remove', payload)
            return context.dispatch('delete', { path: `profiles/${payload}` }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} profileId 
         * 
         */
        select(context, profileId) {
            if (context.getters.selectedKey !== profileId) context.commit('select', profileId)
        },
        /**
         * @param {ActionContext} context 
         * @param {CreateOption} payload 
         */
        createAndSelect(context, payload) {
            return context.dispatch('create', payload).then(id => context.commit('select', id))
        },
    },
}
