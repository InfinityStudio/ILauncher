import Vue from 'vue';
import { getExpectVersion } from 'universal/utils/versions';
import { fitin } from 'universal/utils/object';

/**
 * @param {string} id
 * @param {import("universal/store/modules/java").JavaModule.Java} java
 * @param {string} mcversion
 * @param {string} author
 * @param {'modpack'|'server'}type
 * @return {import("./profile").ProfileModule.Profile}
 */
export function createTemplate(id, java, mcversion, author, type = 'modpack') {
    return {
        id,

        name: '',

        resolution: { width: 800, height: 400, fullscreen: false },
        java,
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],

        mcversion,

        type,
        
        /**
         * Modpack section
         */
        author,
        description: '',
        url: '',
        icon: '',
        
        showLog: false,
        hideLauncher: true,


        forge: {
            mods: [],
            version: '',
        },
        liteloader: {
            mods: [],
            version: '',
        },
        optifine: {
            version: '',
            settings: {},
        },

        settings: {},
        servers: [],
        maps: [],

        refreshing: false,
        problems: [],
    };
}

/**
 * @type {import('./profile').ProfileModule}
 */
const mod = {
    state: {
        all: {},
        id: '',
    },
    getters: {
        profiles: state => Object.keys(state.all).map(k => state.all[k]),
        serverProtocolVersion: state => 338,
        selectedProfile: state => state.all[state.id],
        currentVersion: (state, getters, rootState) => {
            const current = state.all[state.id];
            const minecraft = current.mcversion;
            const forge = current.forge.version;
            const liteloader = current.liteloader.version;

            return {
                id: getExpectVersion(minecraft, forge, liteloader),
                minecraft,
                forge,
                liteloader,
                folder: getExpectVersion(minecraft, forge, liteloader),
            };
        },
    },
    mutations: {
        refreshingProfile(state, refreshing) {
            state.all[state.id].refreshing = refreshing;
        },
        addProfile(state, profile) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (!state.all[profile.id]) {
                Vue.set(state.all, profile.id, profile);
            }
        },
        removeProfile(state, id) {
            Vue.delete(state.all, id);
        },
        selectProfile(state, id) {
            if (state.all[id]) {
                state.id = id;
            } else if (state.id === '') {
                state.id = Object.keys(state.all)[0];
            }
        },
        profile(state, settings) {
            const prof = state.all[state.id];

            prof.name = settings.name || prof.name;
            prof.author = settings.author || prof.author;
            prof.description = settings.description || prof.description;

            if (prof.mcversion !== settings.mcversion && settings.mcversion !== undefined) {
                prof.mcversion = settings.mcversion;
                prof.forge.version = '';
                prof.liteloader.version = '';
            }

            prof.minMemory = settings.minMemory || prof.minMemory;
            prof.maxMemory = settings.maxMemory || prof.maxMemory;
            prof.java = settings.java || prof.java;

            if (prof.java && !prof.java.path) {
                Reflect.deleteProperty(prof, 'java');
            }

            prof.type = settings.type || prof.type;
            prof.icon = settings.icon || prof.icon;

            if (settings.forge && typeof settings.forge === 'object') {
                const { mods, version } = settings.forge;
                const forge = state.all[state.id].forge;
                if (mods instanceof Array && mods.every(m => typeof m === 'string')) {
                    forge.mods = mods;
                }
                if (typeof version === 'string') {
                    forge.version = version;
                }
            }

            if (typeof settings.showLog === 'boolean') {
                prof.showLog = settings.showLog;
            }
            if (typeof settings.hideLauncher === 'boolean') {
                prof.hideLauncher = settings.hideLauncher;
            }
        },

        serverInfos(state, infos) {
            state.all[state.id].servers = infos;
        },
        levelData(state, maps) {
            state.all[state.id].maps = maps;
        },
        gamesettings(state, settings) {
            fitin(state.all[state.id].settings, settings);
        },
        profileProblems(state, problems) {
            state.all[state.id].problems = problems;
        },
    },
};

export default mod;
