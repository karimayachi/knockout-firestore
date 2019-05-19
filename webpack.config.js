const path = require('path');

module.exports = {
    entry: './src/knockout-firestore.ts',
    mode: "development",
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
        filename: 'knockout.firestore.js',
        path: path.resolve(__dirname, 'dist')
    },
    externals: {
        knockout: {
            commonjs: 'knockout',
            commonjs2: 'knockout',
            amd: 'knockout',
            root: 'ko'
        }
    }
};