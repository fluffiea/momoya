#!/usr/bin/env node
// 扫描 SVG → 注入主题色 → 渲染为带透明 padding 的 PNG（inactive + active 两版），
// 覆盖 tabbar 目录下的同名文件。所有参数在下方 DEFAULT_CONFIG 可改，也支持 CLI 覆盖。
//
// 用法：
//   pnpm --filter @momoya/mobile icons:tabbar
//   pnpm --filter @momoya/mobile icons:tabbar -- --ratio 0.55 --canvas 81
//   node scripts/generate-tabbar-icons.mjs --inactive '#C3B59F' --active '#668F80'

import { readdir, readFile, mkdir } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const DEFAULT_CONFIG = {
  svgDir: 'src/assets/icons/tabbar/svg',
  outDir: 'src/assets/icons/tabbar',
  canvas: 81,
  iconRatio: 0.6,
  inactiveColor: '#C3B59F',
  activeColor: '#668F80',
  activeSuffix: '-active',
  density: 384,
}

function parseCliArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function resolveConfig() {
  const args = parseCliArgs(process.argv.slice(2))
  const cfg = { ...DEFAULT_CONFIG }
  if (args.svgDir) cfg.svgDir = String(args.svgDir)
  if (args.outDir) cfg.outDir = String(args.outDir)
  if (args.canvas) cfg.canvas = Number(args.canvas)
  if (args.ratio) cfg.iconRatio = Number(args.ratio)
  if (args.inactive) cfg.inactiveColor = String(args.inactive)
  if (args.active) cfg.activeColor = String(args.active)
  if (args.suffix) cfg.activeSuffix = String(args.suffix)
  if (args.density) cfg.density = Number(args.density)
  if (!(cfg.iconRatio > 0 && cfg.iconRatio <= 1)) {
    throw new Error(`iconRatio 必须在 (0, 1] 之间，实际为 ${cfg.iconRatio}`)
  }
  if (!Number.isInteger(cfg.canvas) || cfg.canvas <= 0) {
    throw new Error(`canvas 必须是正整数，实际为 ${cfg.canvas}`)
  }
  return cfg
}

// 把 SVG 里的纯色 fill/stroke 统一改成目标色；跳过 none / url(...) / currentColor。
function recolorSvg(svg, color) {
  const skip = /^(none|transparent|currentColor|url\(.*\))$/i

  const replaceAttr = (src, attr) => {
    const re = new RegExp(`(${attr})\\s*=\\s*(["'])([^"']*)\\2`, 'gi')
    return src.replace(re, (match, name, quote, value) => {
      if (skip.test(value.trim())) return match
      return `${name}=${quote}${color}${quote}`
    })
  }

  const replaceStyleProp = (src, prop) => {
    const re = new RegExp(`(${prop})\\s*:\\s*([^;"'\\s]+)`, 'gi')
    return src.replace(re, (match, name, value) => {
      if (skip.test(value.trim())) return match
      return `${name}:${color}`
    })
  }

  let out = svg
  out = replaceAttr(out, 'fill')
  out = replaceAttr(out, 'stroke')
  out = replaceStyleProp(out, 'fill')
  out = replaceStyleProp(out, 'stroke')
  return out
}

async function renderOne({ svgText, outPath, color, canvas, iconRatio, density }) {
  const innerSize = Math.max(1, Math.round(canvas * iconRatio))
  const padLeft = Math.floor((canvas - innerSize) / 2)
  const padTop = Math.floor((canvas - innerSize) / 2)
  const padRight = canvas - innerSize - padLeft
  const padBottom = canvas - innerSize - padTop
  const recolored = recolorSvg(svgText, color)

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

  const pipeline = sharp(Buffer.from(recolored), { density })
    .resize(innerSize, innerSize, { fit: 'contain', background: transparent })

  if (padLeft || padRight || padTop || padBottom) {
    pipeline.extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: transparent,
    })
  }

  await pipeline.png().toFile(outPath)
  return { innerSize, padLeft, padTop, padRight, padBottom }
}

async function main() {
  const cfg = resolveConfig()
  const cwd = process.cwd()
  const svgDirAbs = resolve(cwd, cfg.svgDir)
  const outDirAbs = resolve(cwd, cfg.outDir)

  await mkdir(outDirAbs, { recursive: true })

  const entries = await readdir(svgDirAbs, { withFileTypes: true })
  const svgs = entries
    .filter((e) => e.isFile() && extname(e.name).toLowerCase() === '.svg')
    .map((e) => e.name)
    .sort()

  if (svgs.length === 0) {
    console.warn(`[icons:tabbar] 目录下没有 SVG：${svgDirAbs}`)
    return
  }

  console.log(`[icons:tabbar] canvas=${cfg.canvas}, iconRatio=${cfg.iconRatio}, inactive=${cfg.inactiveColor}, active=${cfg.activeColor}`)
  console.log(`[icons:tabbar] from ${cfg.svgDir} → ${cfg.outDir}`)

  for (const file of svgs) {
    const name = basename(file, extname(file))
    const svgPath = join(svgDirAbs, file)
    const svgText = await readFile(svgPath, 'utf8')

    const inactivePath = join(outDirAbs, `${name}.png`)
    const activePath = join(outDirAbs, `${name}${cfg.activeSuffix}.png`)

    const info = await renderOne({
      svgText,
      outPath: inactivePath,
      color: cfg.inactiveColor,
      canvas: cfg.canvas,
      iconRatio: cfg.iconRatio,
      density: cfg.density,
    })
    await renderOne({
      svgText,
      outPath: activePath,
      color: cfg.activeColor,
      canvas: cfg.canvas,
      iconRatio: cfg.iconRatio,
      density: cfg.density,
    })

    console.log(
      `  ✓ ${file} → ${name}.png / ${name}${cfg.activeSuffix}.png  [icon ${info.innerSize}x${info.innerSize} in ${cfg.canvas}x${cfg.canvas}]`,
    )
  }

  console.log(`[icons:tabbar] done: ${svgs.length} svg → ${svgs.length * 2} png`)
}

main().catch((err) => {
  console.error('[icons:tabbar] 失败：', err)
  process.exit(1)
})
