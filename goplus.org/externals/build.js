const { resolve, join } = require('path')
const { copySync } = require('fs-extra')
const { loadEnvConfig } = require('@next/env')
const { runCompiler } = require('next/dist/build/compiler')
const getBaseWebpackConfig = require('next/dist/build/webpack-config')
const { PHASE_PRODUCTION_BUILD } = require('next/dist/shared/lib/constants')
const loadConfig = require('next/dist/server/config')
const { trace, flushAllTraces, setGlobal } = require('next/dist/trace')
const { default: MiniCssExtractPlugin } = require('next/dist/build/webpack/plugins/mini-css-extract-plugin')

// 所有需要对外的 external 组件，对应 /externals/ 下的内容
const externals = [
  'index'
]

const dir = resolve('.')
const outputPath = resolve('.next')
const finalOutputPath = resolve('out')

// 生成 loader 文件到 out 目录
function generateLoader(assetPrefix) {
  const loaderJs = readFileSync(resolve('externals/loader.js'), { encoding: 'utf8' })
  const manifest = require(join(outputPath, 'manifest.json'))
  assetPrefix = assetPrefix.endsWith('/') ? assetPrefix : (assetPrefix + '/')
  const simplifiedManifest = Object.keys(manifest).reduce((o, key) => {
    if (key.indexOf('externals') === 0 && key.slice(-4) !== '.map') {
      o[key] = assetPrefix + '_next/' + manifest[key]
    }
    return o
  }, {})
  const loaderJsWithManifest = loaderJs.replace(/\bMANIFEST\b/g, JSON.stringify(simplifiedManifest))
  const loaderDirPath = join(finalOutputPath, 'externals')
  if (!existsSync(loaderDirPath)) mkdirSync(loaderDirPath)
  writeFileSync(join(finalOutputPath, 'externals/loader.js'), loaderJsWithManifest)
}

// 导出 externals 内容的构建结果（从 .next/ 到 out/）
function exportFiles() {
  copySync(
    join(outputPath, 'static'),
    join(finalOutputPath, '_next', 'static'),
    { errorOnExist: true }
  )
}

async function main() {

  loadEnvConfig(dir, false)

  const nextConfig = await loadConfig.default(PHASE_PRODUCTION_BUILD, dir, null/** TODO */)

  setGlobal('phase', PHASE_PRODUCTION_BUILD)
  // setGlobal('distDir', distDir) // TODO

  const runWebpackSpan = trace('run-webpack')

  const webpackConfig = await getBaseWebpackConfig.default(resolve('.'), {
    buildId: 'externals',
    reactProductionProfiling: false,
    isServer: false,
    config: nextConfig,
    target: nextConfig.target,
    pagesDir: resolve('./pages'),
    entrypoints: {},
    rewrites: {
      fallback: [],
      afterFiles: [],
      beforeFiles: []
    },
    runWebpackSpan
  })

  webpackConfig.entry = externals.reduce(
    (entries, key) => ({
      ...entries,
      [`externals/${key}`]: [
        // next 内置的 polyfill
        // 'next/dist/client/polyfills', // TODO
        './externals/polyfill.ts',
        `./externals/${key}.tsx`
      ]
    }),
    {}
  )

  webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
    if (!rule.oneOf) return rule
    const oneOf = rule.oneOf.filter(r => {
      const isErrorLoader = (r.use || {}).loader === 'error-loader'
      // console.log('rule', isErrorLoader, r)
      return !isErrorLoader
    }).map(r => {
      if (r.test && r.test.toString() === '/(?<!\\.module)\\.(scss|sass)$/') {
        console.log('use', r.use)
        return { ...r, issuer: undefined }
      }
      return r
    })
    console.log('oneOf:', oneOf)
    return { ...rule, oneOf }
  })

  console.log('entries:', webpackConfig.entry)

  webpackConfig.output = {
    path: outputPath,
    filename: 'static/[name].[contenthash].js'
  }

  webpackConfig.plugins = webpackConfig.plugins.filter(
    p => p.constructor.name !== 'MiniCssExtractPlugin'
  ).concat(
    new MiniCssExtractPlugin({
      filename: 'static/[name].[contenthash].css'
    }),
  )

  webpackConfig.optimization.splitChunks = false
  webpackConfig.optimization.runtimeChunk = false

  // 本地调试时打开以提高构建效率
  webpackConfig.optimization.minimize = false
  webpackConfig.devtool = false

  const result = await runCompiler(webpackConfig, { runWebpackSpan })
  if (result.errors && result.errors.length > 0) {
    result.errors.forEach(err => {
      console.error("Error:")
      console.error("moduleName:", err.moduleName)
      console.error("moduleIdentifier:", err.moduleIdentifier)
      console.error("message:", err.message)
    })
    process.exit(1)
  }
  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach(warning => {
      console.warn("Warning:")
      console.warn('loc:', warning.loc)
      console.warn('message:', warning.message)
    })
  }
  await flushAllTraces()
  // exportFiles()
  // generateLoader(nextConfig.assetPrefix)
  console.log('done')
}

main()
