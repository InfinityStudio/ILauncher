
import Ajv from 'ajv';
import { existsSync } from 'fs';
import { fs } from 'main/utils';
import { createContext, runInContext } from 'vm';

export async function readFolder(path: string) {
    if (!path) throw new Error('Path must not be undefined!');
    await fs.ensureDir(path);
    return fs.readdir(path);
}

export async function setPersistence({ path, data, schema }: { path: string; data: object; schema?: object }) {
    const deepCopy = JSON.parse(JSON.stringify(data));
    if (schema) {
        const schemaObject = schema;
        const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
        const validation = ajv.compile(schemaObject);
        const valid = validation(deepCopy);
        if (!valid) {
            const context = createContext({ object: deepCopy });
            if (validation.errors) {
                validation.errors.forEach(e => console.warn(e));
                const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                console.log(cmd.join('\n'));
                runInContext(cmd.join('\n'), context);
            }
        }
    }
    await fs.ensureFile(path);
    return fs.writeFile(path, JSON.stringify(deepCopy, null, 4), { encoding: 'utf-8' });
}

export async function getPersistence(option: { path: string; schema?: object }) {
    const { path, schema } = option;
    if (!existsSync(path)) return undefined;
    const originalString = await fs.readFile(path).then(b => b.toString(), () => '{}');
    const object = JSON.parse(originalString);
    if (object && schema) {
        const schemaObject = schema;
        const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
        const validation = ajv.compile(schemaObject);
        const valid = validation(object);
        if (!valid) {
            console.warn(`Found invalid config file on ${path} in schema ${schema}.`);
            // console.warn('Try to remove those invalid keys. This might cause problem.');
            // console.warn(originalString);
            const context = createContext({ object });
            if (validation.errors) {
                validation.errors.forEach(e => console.warn(e));
                const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                console.log(cmd.join('\n'));
                runInContext(cmd.join('\n'), context);
            }
        }
    }

    return object;
}
