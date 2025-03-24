const webpack = require('webpack');
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // 환경 변수 설정 - 개별적으로 명시
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      'process.env.NEXT_PUBLIC_OPENAI_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_OPENAI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      '__DEV__': env.mode === 'development'
    })
  );

  // 진입점에 환경 변수 설정 추가
  if (!config.entry) {
    config.entry = [];
  }
  if (Array.isArray(config.entry)) {
    config.entry.unshift(path.resolve(__dirname, 'src/config/env.ts'));
  } else if (typeof config.entry === 'object') {
    Object.keys(config.entry).forEach(key => {
      const entry = config.entry[key];
      if (Array.isArray(entry)) {
        entry.unshift(path.resolve(__dirname, 'src/config/env.ts'));
      }
    });
  }

  // resolve 설정 강화
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      '@config': path.resolve(__dirname, 'src/config'),
      '../config/env': path.resolve(__dirname, 'src/config/env.ts'),
      './config/env': path.resolve(__dirname, 'src/config/env.ts'),
      'config/env': path.resolve(__dirname, 'src/config/env.ts')
    },
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules'
    ],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.jsx', '.web.js', '.jsx', '.js']
  };

  return config;
}; 