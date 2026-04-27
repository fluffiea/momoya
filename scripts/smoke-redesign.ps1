# 朝夕/见证/独白 架构改版冒烟：覆盖 Anniversary CRUD 与 User.settings PATCH。
# 前提：后端跑在 http://localhost:3000，DB 已 seed jiangjiang / mengmeng，
# seed 已自动补写 system「在一起」纪念日。
#
# 与 smoke-m4-plus.ps1 共享相同的 Req / Ok / ExpectFail helper，
# 这里直接内联一份避免脚本间强依赖。

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'

function Hdr($token) { return @{ Authorization = "Bearer $token" } }

function Req {
  param(
    [Parameter(Mandatory)] [string] $Method,
    [Parameter(Mandatory)] [string] $Uri,
    [hashtable] $Headers = @{},
    [object] $Body = $null
  )
  $params = @{
    Method  = $Method
    Uri     = $Uri
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $json = if ($Body -is [string]) { $Body } else { ConvertTo-Json -InputObject $Body -Compress -Depth 10 }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $params['ContentType'] = 'application/json; charset=utf-8'
    $params['Body'] = $bytes
  }
  return Invoke-RestMethod @params
}

function Ok($resp, $label) {
  if ($resp.code -ne 0) { throw "$label failed: $($resp | ConvertTo-Json -Compress -Depth 6)" }
}

function ExpectFail($block, $errorKey, $label) {
  try {
    $r = & $block
    throw "$label should have failed but got: $($r | ConvertTo-Json -Compress -Depth 6)"
  } catch {
    $raw = $_.ErrorDetails.Message
    if (-not $raw) {
      $resp = $_.Exception.Response
      if ($resp -and $resp.GetResponseStream) {
        try {
          $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
          $raw = $reader.ReadToEnd()
        } catch {}
      }
    }
    if (-not $raw) { $raw = $_.Exception.Message }
    if (-not ($raw -match $errorKey)) {
      throw "$label expected errorKey=$errorKey but got: $raw"
    }
    Write-Host "  (ok) $label -> $errorKey" -ForegroundColor DarkGray
  }
}

function Login($username, $password) {
  $resp = Req -Method Post -Uri "$base/auth/login" -Body @{ username = $username; password = $password }
  Ok $resp "login $username"
  return $resp.data
}

Write-Host '== login jiangjiang & mengmeng ==' -ForegroundColor Cyan
$j = Login 'jiangjiang' '251212'
$m = Login 'mengmeng' '251212'

# ---------- 1. 列表里应有 system「在一起」 ----------
Write-Host "`n== [1] jiang 查纪念日列表 ==" -ForegroundColor Cyan
$r = Req -Method Get -Uri "$base/anniversaries" -Headers (Hdr $j.accessToken)
Ok $r 'list anniversaries (jiang)'
$sys = $r.data.items | Where-Object { $_.isSystem -eq $true }
if (-not $sys) { throw '没有看到 system 纪念日（seed 未生效？）' }
if ($sys.name -ne '在一起') { throw "system name 期望「在一起」，实际: $($sys.name)" }
$sysId = $sys.id
Write-Host "  system.id=$sysId  date=$($sys.date)"

# meng 查应该看到同一条
$r2 = Req -Method Get -Uri "$base/anniversaries" -Headers (Hdr $m.accessToken)
Ok $r2 'list anniversaries (meng)'
if (-not ($r2.data.items | Where-Object { $_.id -eq $sysId })) {
  throw 'meng 看不到 couple 共享的 system 纪念日'
}

# ---------- 2. system 只能改 date，不能改 name ----------
Write-Host "`n== [2] system 改日期应成功 ==" -ForegroundColor Cyan
$newDate = '2024-05-20T00:00:00.000Z'
$r = Req -Method Patch -Uri "$base/anniversaries/$sysId" -Headers (Hdr $j.accessToken) -Body @{ date = $newDate }
Ok $r 'patch system date'
if ($r.data.date -notmatch '^2024-05-20') { throw "date 未更新为 5/20: $($r.data.date)" }

Write-Host "  system 改 name 应被拒" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Patch -Uri "$base/anniversaries/$sysId" -Headers (Hdr $j.accessToken) -Body @{ name = '改个名' }
} 'E_ANNIV_SYSTEM_READONLY' 'system rename'

Write-Host "  system 被删应被拒" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Delete -Uri "$base/anniversaries/$sysId" -Headers (Hdr $j.accessToken)
} 'E_ANNIV_SYSTEM_READONLY' 'system delete'

# ---------- 3. 创建 / 删除 普通纪念日 ----------
Write-Host "`n== [3] jiang 新建普通纪念日 ==" -ForegroundColor Cyan
$r = Req -Method Post -Uri "$base/anniversaries" -Headers (Hdr $j.accessToken) -Body @{
  name = '第一次牵手'
  date = '2023-10-01T00:00:00.000Z'
}
Ok $r 'create anniv'
$custId = $r.data.id
if ($r.data.name -ne '第一次牵手') { throw "name 乱码: $($r.data.name)" }
if ($r.data.isSystem) { throw '新建的纪念日不该是 system' }

# meng 也能编辑（couple 双方都可以）
Write-Host "  meng 改名/改日期都允许" -ForegroundColor DarkGray
$r = Req -Method Patch -Uri "$base/anniversaries/$custId" -Headers (Hdr $m.accessToken) -Body @{ name = '第一次约会' }
Ok $r 'meng patch name'
if ($r.data.name -ne '第一次约会') { throw "meng 改名未生效: $($r.data.name)" }

# jiang 删（meng 也行，这里由 jiang 删）
$r = Req -Method Delete -Uri "$base/anniversaries/$custId" -Headers (Hdr $j.accessToken)
Ok $r 'delete anniv'

# ---------- 4. settings: defaultWitnessTab ----------
Write-Host "`n== [4] PATCH /users/me settings.defaultWitnessTab ==" -ForegroundColor Cyan
$r = Req -Method Patch -Uri "$base/users/me" -Headers (Hdr $j.accessToken) -Body @{
  settings = @{ defaultWitnessTab = 'report' }
}
Ok $r 'patch settings report'
if ($r.data.settings.defaultWitnessTab -ne 'report') {
  throw "settings 未更新为 report: $($r.data.settings.defaultWitnessTab)"
}

# 其他字段不被覆盖
if (-not $r.data.nickname) { throw 'nickname 被 settings patch 冲掉了？' }

# 换回 daily，别污染 jiang 的偏好
$r = Req -Method Patch -Uri "$base/users/me" -Headers (Hdr $j.accessToken) -Body @{
  settings = @{ defaultWitnessTab = 'daily' }
}
Ok $r 'patch settings daily'
if ($r.data.settings.defaultWitnessTab -ne 'daily') { throw '换回 daily 失败' }

# 非法枚举值应 400
Write-Host "  非法值 'whatever' 应被拒" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Patch -Uri "$base/users/me" -Headers (Hdr $j.accessToken) -Body @{
    settings = @{ defaultWitnessTab = 'whatever' }
  }
} 'E_VALIDATION' 'invalid witness tab'

# ---------- 5. GET /auth/me 带回 settings ----------
Write-Host "`n== [5] GET /auth/me 带回 settings ==" -ForegroundColor Cyan
$r = Req -Method Get -Uri "$base/auth/me" -Headers (Hdr $j.accessToken)
Ok $r 'get me'
if (-not $r.data.settings) { throw '/auth/me 没有返回 settings' }
if ($r.data.settings.defaultWitnessTab -ne 'daily') {
  throw "/auth/me settings 不对: $($r.data.settings.defaultWitnessTab)"
}

Write-Host "`nALL REDESIGN SMOKE PASSED" -ForegroundColor Green
