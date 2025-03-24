const webpack = require('webpack');
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // 환경 변수 설정
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      'process.env.NEXT_PUBLIC_OPENAI_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_OPENAI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      '__DEV__': env.mode === 'development'
    })
  );

  // 간소화된 resolve 설정
  config.resolve = {
    ...config.resolve,
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  };

  return config;
}; 