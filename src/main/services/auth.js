import {
    v4,
} from 'uuid'
import launcher from '../launcher'

const fs = require('fs')
const {
    AuthService,
} = require('ts-minecraft')

const registered = new Map()
export default {
    initialize() {
        registered.set('offline', ({
            account,
            clientToken,
        }) => AuthService.offlineAuth(account));
        registered.set('mojang', ({
            account,
            password,
            clientToken,
        }) => AuthService.yggdrasilAuth({
            username: account,
            password,
            clientToken: clientToken || v4(),
        }));
    },

    proxy: {
        register(id, func) {
            if (registered.has(id)) {
                throw new Error(`duplicated id: ${id}`)
            }
            registered.set(id, func)
        },
        modes() {
            return Array.from(registered.keys())
        },
    },

    actions: {
        login(option) {
            return new Promise((resolve, reject) => {
                if (registered.has(option.mode)) {
                    resolve(registered.get(option.mode)(option))
                } else {
                    reject(`No such auth option ${option.mode}`)
                }
            });
        },
        // TODO implement other auth function
    },
}
