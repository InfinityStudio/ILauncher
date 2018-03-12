import { net, app } from 'electron'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import download from 'ts-minecraft/dist/src/utils/download'
import Zip from 'jszip'
import { exec } from 'child_process'

async function findJava() {
    let all = [];
    const file = os.platform() === 'win32' ? 'java.exe' : 'java';
    process.env.PATH.split(';').forEach(p => all.push(path.join(p, 'bin', file)))
    if (process.env.JAVA_HOME) all.push(path.join(process.env.JAVA_HOME, 'bin', file))
    if (os.platform() === 'win32') {
        const out = await new Promise((resolve, reject) => {
            exec('REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome', (error, stdout, stderr) => {
                if (!stdout) reject();
                resolve(stdout.split(os.EOL).map(item => (
                    item.replace(/[\r\n]/g, '')))
                    .filter(item => item != null && item !== undefined)
                    .map(item => (item instanceof Array ? item[0] : item))
                    .map(item => path.join(item, 'bin', 'javaw.exe')))
            });
        })
        all.push(...out);
    } else if (os.platform() === 'darwin') {
        all.push('/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java');
    }
    const set = {};
    all.filter(p => fs.existsSync(p)).forEach((p) => { set[p] = 0 })
    all = [];
    for (const p of Object.keys(set)) {
        if (await new Promise((resolve, reject) => {
            exec(`"${p}" -version`, (err, sout, serr) => {
                resolve(serr && serr.indexOf('java version') !== -1)
            });
        })) {
            all.push(p);
        }
    }
    return all;
}

// https://api.github.com/repos/Indexyz/ojrebuild/releases
async function installJre() {
    const info = await new Promise((resolve, reject) => {
        const req = net.request({
            method: 'GET',
            protocol: 'https:',
            hostname: 'api.github.com',
            path: '/repos/Indexyz/ojrebuild/releases',
        })
        req.setHeader('User-Agent', 'ILauncher')
        req.end();
        let infojson = ''
        req.on('response', (response) => {
            response.on('data', (data) => {
                infojson += data.toString();
            })
            response.on('end', () => {
                resolve(JSON.parse(infojson))
            })
            response.on('error', (e) => {
                console.error(`${response.headers}`);
            })
        })
        req.on('error', (err) => {
            reject(err)
        })
    });
    const latest = info[0];
    let buildSystemId;
    let arch;
    switch (os.arch()) {
        case 'x86':
        case 'x32':
            arch = 'x86'
            break;
        case 'x64':
            arch = 'x86_64'
            break;
        default:
            arch = 'x86';
    }
    switch (os.platform()) {
        case 'darwin': break;
        case 'win32':
            buildSystemId = 'windows';
            break;
        case 'linux':
            buildSystemId = 'el6_9';
            break;
        default:
            buildSystemId = ''
    }
    if (!buildSystemId) throw new Error(`Not supporting system ${os.platform()}`);
    if (!arch) throw new Error(`Not supporting arch ${os.arch()}`)
    const downURL = latest.assets.map(ass => ass.browser_download_url)
        .filter((ass) => {
            const arr = ass.split('.');
            return arr[arr.length - 2] === arch // && sys === arr[arr.length - 3]
        })[0]
    const splt = downURL.split('/');
    const tempFileLoc = path.join(app.getPath('temp'), splt[splt.length - 1]);
    // console.log('start download')
    // console.log(tempFileLoc);
    await fs.ensureFile(tempFileLoc)
    // console.log(`download url ${downURL}`)
    await download(downURL, tempFileLoc);
    const jreRoot = path.join(app.getPath('userData'), 'jre')
    // console.log(`jreRoot ${jreRoot}`)
    const zip = await new Zip().loadAsync(await fs.readFile(tempFileLoc))
    const arr = []
    zip.forEach((name, entry) => {
        const target = path.resolve(jreRoot, name)
        arr.push(entry.async('nodebuffer')
            .then(buf => fs.ensureFile(target).then(() => buf))
            .then(buf => fs.writeFile(target, buf)))
    })
    await Promise.all(arr);
    // console.log('deleting temp')
    await fs.unlink(tempFileLoc)
}

export default {
    namespaced: true,
    state: {
        javas: [],
        blacklist: [],
        default: '',
    },
    getters: {
        javas: state => state.javas.filter(loc => state.blacklist.indexOf(loc) === -1),
        defaultJava: state => state.default,
    },
    mutations: {
        javas(state, inJava) {
            if (inJava instanceof Array) state.javas.push(...inJava);
            else state.push(inJava);
        },
        blackList(state, java) { state.blacklist.push(java) },
    },
    actions: {
        add(context, java) {
            context.commit('javas', context.getters.javas.concat(java))
        },
        remove(context, java) {
            const newarr = context.getters.javas.filter(j => j !== java);
            if (newarr.length !== context.getters.javas.length) {
                context.commit('javas', newarr)
            }
        },
        /**
         * scan local java locations and cache
         */
        async refresh({ dispatch, commit }) {
            const arr = await findJava();
            const local = path.join(app.getPath('userData'), 'jre', 'bin', 'javaw.exe');
            if (fs.existsSync(local)) arr.unshift(local);
            commit('javas', arr);
            return arr;
        },
        async download(context) {
            const arr = await findJava();
            const local = path.join(app.getPath('userData'), 'jre', 'bin', 'javaw.exe');
            if (fs.existsSync(local)) arr.unshift(local);
            if (arr.length === 0) {
                await installJre();
                if (fs.existsSync(local)) arr.unshift(local);
            }
            return arr;
        },
    },
}
