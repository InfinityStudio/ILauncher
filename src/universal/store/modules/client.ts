import { isCompatible } from 'universal/utils/versions';
import { Module, Context } from "..";

export namespace ClientModule {
    export type ProtocolToVersion = {
        [protocol: string]: string[];
    };
    export type PackFormatToVersioRange = {
        [range: string]: string;
    };

    export type MinecraftVersion = string;

    export interface ResourcePackFormatMapping {
        mcversion: {
            [format: number]: string;
        };
    }
    export interface ClientProtocolMapping {
        protocol: {
            [mcversion: string]: number;
        };
        mcversion: {
            [protocol: number]: MinecraftVersion[];
        };
    }

    export interface State {
        protocolMapping: ClientProtocolMapping;
        packFormatMapping: ResourcePackFormatMapping;
    }

    export interface Getters {
        getAcceptMinecraftRangeByFormat(format: number): string;
        getAcceptMinecraftsByProtocol(protocol: number): string[];
        isResourcePackCompatible(format: number, mcversion: string): boolean;
    }

    export interface Mutations {
        packFormatMapping(state: State, mapping: ResourcePackFormatMapping): void;
        protocolMapping(state: State, mapping: ClientProtocolMapping): void;
    }
    type C = Context<State, Getters>;
    export interface Actions {
    }
}

export interface ClientModule extends Module<"client", ClientModule.State, ClientModule.Getters, ClientModule.Mutations, ClientModule.Actions> { }

const mod: ClientModule = {
    state: {
        protocolMapping: {
            protocol: {},
            mcversion: {},
        },
        packFormatMapping: {
            mcversion: Object.freeze({
                1: '[1.6, 1.9)',
                2: '[1.9, 1.11)',
                3: '[1.11, 1.13)',
                4: '[1.13,]',
            }),
        },
    },
    getters: {
        getAcceptMinecraftRangeByFormat: state => format => state.packFormatMapping.mcversion[format] || '',
        getAcceptMinecraftsByProtocol: state => protocol => state.protocolMapping.mcversion[protocol] || [],
        isResourcePackCompatible: state => (format, mcversion) => isCompatible(mcversion,
            state.packFormatMapping.mcversion[format]),
    },
    mutations: {
        protocolMapping(state, p) {
            state.protocolMapping = Object.freeze(p);
        },
        packFormatMapping(state, m) {
            state.packFormatMapping = Object.freeze(m);
        },
    },
};

export default mod;
