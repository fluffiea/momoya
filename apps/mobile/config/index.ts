import path from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'

import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'mobile',
    date: '2026-4-22',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [
      "@tarojs/plugin-generator"
    ],
    // Taro 4 + Vite 默认只注入 process.env.NODE_ENV；其余 process.env.XXX 必须
    // 在此显式声明，否则会以 `process.env.XXX` 字符串原样落进小程序包，
    // 触发 `ReferenceError: process is not defined`。
    // 这里把本项目用到的 TARO_APP_* 在构建期全部冻结为字符串字面量。
    defineConstants: {
      'process.env.TARO_APP_DEV_API_HOST': JSON.stringify(
        process.env.TARO_APP_DEV_API_HOST || ''
      ),
      'process.env.TARO_APP_DEV_API_PORT': JSON.stringify(
        process.env.TARO_APP_DEV_API_PORT || ''
      ),
      // 与 src/config/index.ts 中 TARO_APP_WS_URL 一致，避免小程序运行时残留 process.env
      'process.env.TARO_APP_WS_URL': JSON.stringify(
        process.env.TARO_APP_WS_URL ?? ''
      ),
    },
    copy: {
      patterns: [
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: [
        {
          name: 'postcss-config-loader-plugin',
          config(viteConfig) {
            if (viteConfig.css && typeof viteConfig.css.postcss === 'object') {
              viteConfig.css.postcss.plugins ??= []
              viteConfig.css.postcss.plugins.unshift(tailwindcss())
            } else {
              viteConfig.css = {
                ...(viteConfig.css ?? {}),
                postcss: { plugins: [tailwindcss()] }
              }
            }
          }
        },
        UnifiedViteWeappTailwindcssPlugin({
          rem2rpx: true,
          injectAdditionalCssVarScope: true,
          cssEntries: [path.resolve(__dirname, '../src/app.css')]
        })
      ]
    },
    mini: {
      // Taro 4.x + Vite 在小程序生产打包时，会把带有 `react.ts/tsx` 文件名的第三方模块
      // 误识别为 React 本身做替换，导致 zustand v5+ 报 `taro.react_production_min.create
      // is not a function`。debugReact: true 跳过该替换逻辑（副作用：使用非压缩的
      // React dev 包，bundle 稍大）。详见 NervJS/taro#17350。
      debugReact: true,
      postcss: {
        // 小程序端：px → rpx（按 750 设计稿），详见 .cursor/rules/styling-conventions.mdc
        pxtransform: {
          enable: true,
          config: {
            platform: 'weapp',
            designWidth: 750,
            onePxTransform: true,
          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        /*
         * H5 端：px → rem，并配合 src/index.html 的根字号自适应脚本
         *
         * 关键约束：rootValue 必须与 weapp-tailwindcss rem2rpx 的基准对齐
         *   - weapp-tailwindcss 默认 1rem = 32rpx（Tailwind 原生 1rem = 16px）
         *   - 对应 rootValue = 32 → baseFontSize = 16
         *   - index.html 脚本让 rootFontSize = 32 * viewportWidth / 750
         *     @375 屏 = 16px，@414 屏 ≈ 17.66px
         *   - 于是 Tailwind 类与自定义 px 在两端所有屏宽下视觉一致
         */
        pxtransform: {
          enable: true,
          config: {
            platform: 'h5',
            designWidth: 750,
            onePxTransform: true,
            baseFontSize: 16,
            maxRootSize: 32,
            minRootSize: 16,
          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
