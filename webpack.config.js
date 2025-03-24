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

  // 모듈 mocking 설정
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /expo-modules-core/,
      (resource) => {
        if (resource.request.includes("NativeModulesProxy") || 
            resource.request.includes("EventEmitter")) {
          resource.request = path.resolve(__dirname, 'src/mocks/expo-modules-mock.js');
        }
      }
    )
  );

  // React Native Web 호환성을 위한 별칭 추가
  config.resolve = {
    ...config.resolve,
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
      // React Native 내부 모듈 경로 매핑
      '../Utilities/Platform': 'react-native-web/dist/exports/Platform',
      './Platform': 'react-native-web/dist/exports/Platform',
      // Expo 모듈 매핑
      'expo-asset': 'expo-asset/build/Browser',
      'expo-constants': 'expo-constants/build/Browser',
      'expo-file-system': 'expo-file-system/build/Browser',
      'expo-font': 'expo-font/build/Browser',
      // 문제가 발생하는 모듈에 대한 mock 구현 추가
      'expo-modules-core': path.resolve(__dirname, 'src/mocks/expo-modules-mock.js'),
    },
    fallback: {
      ...config.resolve.fallback,
      'crypto': require.resolve('crypto-browserify'),
      'stream': require.resolve('stream-browserify'),
      'path': require.resolve('path-browserify')
    }
  };

  return config;
}; 