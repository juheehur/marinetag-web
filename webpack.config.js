const webpack = require('webpack');
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // 환경 변수 설정
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env),
      '__DEV__': env.mode === 'development'
    })
  );

  // resolve 설정 수정
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      '@config': path.resolve(__dirname, 'src/config'),
    },
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules'
    ]
  };

  return config;
}; 