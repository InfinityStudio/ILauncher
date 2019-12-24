const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const { dependencies } = require('../package.json');

/**
 * @type {import('webpack').Configuration}
 */
const mainConfig = {
    mode: process.env.NODE_ENV,
    entry: {
        main: path.join(__dirname, '../src/main/main.ts'),
    },
    externals: [
        ...Object.keys(dependencies || {}),
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    'cache-loader',
                    {
                        loader: 'thread-loader',
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            happyPackMode: true,
                            // transpileOnly: true,
                        }
                    }
                ],
                exclude: /node_modules/,
                include: [path.join(__dirname, '../src/main'), path.join(__dirname, '../src/universal')],
            },
            {
                test: /\.node$/,
                use: 'node-loader',
            },
        ],
    },
    node: {
        __dirname: process.env.NODE_ENV !== 'production',
        __filename: process.env.NODE_ENV !== 'production',
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                cache: true,
                parallel: true,
                sourceMap: true,
                extractComments: true,
                terserOptions: {
                    ecma: 6,
                    keep_classnames: true,
                },
            })
        ],
    },
    output: {
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        path: path.join(__dirname, '../dist/electron'),
    },
    plugins: [
        new webpack.NoEmitOnErrorsPlugin(),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: 'main.report.html',
            openAnalyzer: false,
        }),
        // new ForkTsCheckerWebpackPlugin({
        //     // eslint: true,
        //     tsconfig: path.resolve(__dirname, '../tsconfig.json'),
        // }),
    ],
    resolve: {
        extensions: ['.js', '.ts', '.json', '.node'],
        alias: {
            main: path.join(__dirname, '../src/main'),
            vue$: 'vue/dist/vue.runtime.esm.js',
            static: path.join(__dirname, '../static'),
            universal: path.join(__dirname, '../src/universal'),
        },
    },
    target: 'electron-main',
};

/**
 * Adjust mainConfig for development settings
 */
if (process.env.NODE_ENV !== 'production') {
    mainConfig.devtool = 'source-map';
    mainConfig.plugins.push(
        new webpack.DefinePlugin({
            __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
        }),
    );
}

/**
 * Adjust mainConfig for production settings
 */
if (process.env.NODE_ENV === 'production') {
    mainConfig.plugins.push(
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': '"production"',
        }),
    );
}

module.exports = mainConfig;
