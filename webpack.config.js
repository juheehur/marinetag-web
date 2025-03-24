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

  // 모듈 대체 설정 강화
  config.plugins.push(
    // 모듈 요청 패턴에 따라 특정 모듈을 모의 구현으로 대체
    new webpack.NormalModuleReplacementPlugin(
      /expo-modules-core\/build\/NativeModulesProxy/,
      path.resolve(__dirname, 'src/mocks/expo-modules-core.js')
    )
  );

  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /expo-modules-core/,
      (resource) => {
        if (resource.request === 'expo-modules-core') {
          resource.request = path.resolve(__dirname, 'src/mocks/expo-modules-core.js');
        }
      }
    )
  );

  // 웹 환경에서 사용할 수 없는 네이티브 기능 모의 구현으로 대체
  config.plugins.push(
    new webpack.ProvidePlugin({
      'NativeModules': ['react-native-web', 'NativeModules'],
      'Platform': ['react-native-web', 'Platform']
    })
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
      'expo-modules-core': path.resolve(__dirname, 'src/mocks/expo-modules-core.js'),
      'expo-modules-core/NativeModulesProxy': path.resolve(__dirname, 'src/mocks/expo-modules-core.js'),
    },
    fallback: {
      ...config.resolve.fallback,
      'crypto': require.resolve('crypto-browserify'),
      'stream': require.resolve('stream-browserify'),
      'path': require.resolve('path-browserify')
    }
  };

  // 웹 환경에서 지원되지 않는 네이티브 모듈 무시
  config.module = {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
        test: /\.(tsx|ts|jsx|js|mjs)$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  };

  return config;
}; 