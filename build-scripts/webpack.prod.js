const path = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: 'production',
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    output: {
        filename: 'knockout.firestore.min.js',
        path: path.resolve(__dirname, '../dist'),
        library: 'kofs'
    },
    externals: {
        knockout: 'ko'
        // knockout: {
        //     commonjs: 'knockout',
        //     commonjs2: 'knockout',
        //     amd: 'knockout',
        //     root: 'ko'
        // }
    }
};