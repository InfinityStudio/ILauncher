import { app } from 'electron';
import locales from 'static/locales';
import { autoUpdater, UpdaterSignal } from 'electron-updater';
import Task from 'treelike-task';
import base from 'universal/store/modules/config';

/**
 * @type {import('universal/store/modules/config').ConfigModule}
 */
const mod = {
    ...base,
    actions: {
        async load(context) {
            const data = await context.dispatch('getPersistence', { path: 'config.json' }) || {};
            context.commit('config', {
                locale: data.locale || app.getLocale(),
                locales: Object.keys(locales),
                autoInstallOnAppQuit: data.autoInstallOnAppQuit,
                autoDownload: data.autoDownload,
                allowPrerelease: data.allowPrerelease,
                settings: data.settings,
            });
        },
        async save(context, { mutation }) {
            switch (mutation) {
                case 'config':
                case 'locale':
                case 'allowPrerelease':
                case 'autoInstallOnAppQuit':
                case 'autoDownload':
                case 'settings':
                    await context.dispatch('setPersistence', { path: 'config.json', data: context.state });
                    break;
                default:
            }
        },

        async quitAndInstall(context) {
            if (context.state.readyToUpdate) {
                autoUpdater.quitAndInstall();
            }
        },

        async checkUpdate({ dispatch, commit }) {
            commit('checkingUpdate', true);
            const task = Task.create('checkUpdate', async (context) => {
                try {
                    const info = await autoUpdater.checkForUpdates();
                    commit('updateInfo', info.updateInfo);
                    return info;
                } catch {
                    return undefined;
                } finally {
                    commit('checkingUpdate', false);
                }
            });
            return dispatch('executeTask', task);
        },

        async downloadUpdate(context) {
            if (!context.state.autoDownload) {
                context.commit('downloadingUpdate', true);
                const task = Task.create('downloadUpdate', ctx => new Promise((resolve, reject) => {
                    autoUpdater.downloadUpdate();
                    const signal = new UpdaterSignal(autoUpdater);
                    signal.updateDownloaded((info) => {
                        resolve(info);
                    });
                    signal.progress((info) => {
                        ctx.update(info.transferred, info.total);
                    });
                    signal.updateCancelled((info) => {
                        reject(info);
                    });
                    autoUpdater.on('error', (err) => {
                        reject(err);
                    });
                }).finally(() => {
                    context.commit('downloadingUpdate', false);
                }));
                return context.dispatch('executeTask', task);
            }
            return undefined;
        },
    },
};

export default mod;