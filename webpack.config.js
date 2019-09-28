const path = require('path');

module.exports = env => {

	const minimize = !!(env && env.minimize);
	const appName = minimize ? 'import-html-entry.min' : 'import-html-entry';

	return {
		entry: {
			[appName]: './src/index.js',
		},
		devtool: 'source-map',
		output: {
			path: path.resolve(__dirname, './dist'),
			filename: '[name].js',
			libraryTarget: 'umd',
			library: 'importHTML',
			libraryExport: 'default',
		},
		mode: 'production',
		optimization: {
			minimize,
		},
		node: {
			process: false,
		},
		module: {
			rules: [
				{ parser: { system: false } },
				{
					test: '/\.js$/',
					use: 'babel-loader',
					exclude: '/node_modules/',
				},
			],
		},
	};
};
