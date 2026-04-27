# M4+ 冒烟：覆盖日常 / 报备 / tag / 评价 / 已阅 全链路。
# 前提：后端已跑在 http://localhost:3000，且 DB 里已经 seed 了 jiangjiang / mengmeng。
#
# 说明：Windows PowerShell 5.1 的 Invoke-RestMethod 在没有 -ContentType charset 的情况下，
# 会按 ISO-8859-1 编码 body，导致中文传到后端变成乱码。这里统一用 Req helper 把 JSON
# 字符串显式编码成 UTF-8 bytes 再发。

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
Write-Host "  jiang.id=$($j.user.id)  meng.id=$($m.user.id)"

# ---------- 0. 清环境：把 jiang 的 custom tag 全删（忽略失败） ----------
$existing = Req -Method Get -Uri "$base/tags" -Headers (Hdr $j.accessToken)
Ok $existing 'list jiang tags'
foreach ($t in $existing.data.items) {
  if ($t.source -eq 'custom') {
    try {
      Req -Method Delete -Uri "$base/tags/$([uri]::EscapeDataString($t.name))" -Headers (Hdr $j.accessToken) | Out-Null
    } catch { }
  }
}

# ---------- 1. 日常发布（含 tags + happenedAt） ----------
Write-Host "`n== [1] jiang 发一条日常（tags + happenedAt） ==" -ForegroundColor Cyan
$r = Req -Method Post -Uri "$base/posts" -Headers (Hdr $j.accessToken) -Body @{
  type = 'daily'
  text = 'hello m4+'
  tags = @('吃饭', '约会')
  happenedAt = (Get-Date).AddHours(-2).ToUniversalTime().ToString('o')
}
Ok $r 'create daily'
$dailyId = $r.data.id
Write-Host "  daily.id=$dailyId  tags=$($r.data.tags -join ',')  happenedAt=$($r.data.happenedAt)"
if ($r.data.tags -join ',' -ne '吃饭,约会') { throw "tags 写入失败: $($r.data.tags -join ',')" }

# ---------- 2. 日常列表 meng 看到 jiang 的帖 ----------
Write-Host "`n== [2] meng 看日常 feed ==" -ForegroundColor Cyan
$r = Req -Method Get -Uri "$base/posts?type=daily" -Headers (Hdr $m.accessToken)
Ok $r 'list daily'
if (-not ($r.data.items | Where-Object { $_.id -eq $dailyId })) { throw 'meng 看不到 jiang 的日常' }
Write-Host "  meng 看到 $($r.data.items.Count) 条日常"

# ---------- 3. 编辑日常 ----------
Write-Host "`n== [3] jiang 编辑日常 ==" -ForegroundColor Cyan
$r = Req -Method Patch -Uri "$base/posts/$dailyId" -Headers (Hdr $j.accessToken) -Body @{ text = 'hello m4+ edited'; tags = @('约会') }
Ok $r 'patch daily'
if ($r.data.text -ne 'hello m4+ edited') { throw 'text 未更新' }
if ($r.data.tags.Count -ne 1) { throw 'tags 未更新' }
if ($r.data.tags[0] -ne '约会') { throw "tag 写入乱码: $($r.data.tags[0])" }

# ---------- 4. 报备相关：jiang 自定义 tag ----------
Write-Host "`n== [4] jiang 创建自定义 tag '看电影' ==" -ForegroundColor Cyan
$r = Req -Method Post -Uri "$base/tags" -Headers (Hdr $j.accessToken) -Body @{ name = '看电影' }
Ok $r 'create tag'
if ($r.data.name -ne '看电影') { throw "custom tag 写入乱码: $($r.data.name)" }

Write-Host "  (1) 重复名称应返回 E_TAG_DUPLICATE" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Post -Uri "$base/tags" -Headers (Hdr $j.accessToken) -Body @{ name = '看电影' }
} 'E_TAG_DUPLICATE' 'duplicate tag name'

Write-Host "  (2) 与 preset 同名也应拒绝" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Post -Uri "$base/tags" -Headers (Hdr $j.accessToken) -Body @{ name = '干饭' }
} 'E_TAG_DUPLICATE' 'preset conflict'

# ---------- 5. 报备发布（tags 来自 preset + custom） ----------
Write-Host "`n== [5] jiang 发报备（干饭 + 看电影） ==" -ForegroundColor Cyan
$r = Req -Method Post -Uri "$base/posts" -Headers (Hdr $j.accessToken) -Body @{
  type = 'report'
  text = '中午跟同事吃饭，顺便看个午场'
  tags = @('干饭', '看电影')
}
Ok $r 'create report'
$reportId = $r.data.id
Write-Host "  report.id=$reportId  tags=$($r.data.tags -join ',')"

Write-Host "  报备必须带 tag，空 tag 应被拒" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Post -Uri "$base/posts" -Headers (Hdr $j.accessToken) -Body @{ type = 'report'; text = 'no tag report' }
} 'E_VALIDATION' 'report without tag'

Write-Host "  报备 tag 必须在允许集合内" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Post -Uri "$base/posts" -Headers (Hdr $j.accessToken) -Body @{ type = 'report'; text = 'bad tag'; tags = @('不存在的tag') }
} 'E_VALIDATION' 'report illegal tag'

# ---------- 6. 报备 filter：meng 在 unread 里能看到 jiang 的报备 ----------
Write-Host "`n== [6] meng 未阅 filter ==" -ForegroundColor Cyan
$r = Req -Method Get -Uri "$base/posts?type=report&filter=unread" -Headers (Hdr $m.accessToken)
Ok $r 'list report unread'
if (-not ($r.data.items | Where-Object { $_.id -eq $reportId })) { throw 'meng unread 里没有 jiang 的报备' }

# ---------- 7. meng 标记已阅 ----------
Write-Host "`n== [7] meng 标记已阅 ==" -ForegroundColor Cyan
$r = Req -Method Post -Uri "$base/posts/$reportId/read" -Headers (Hdr $m.accessToken) -Body @{}
Ok $r 'mark read'
Write-Host "  readAt=$($r.data.readAt)"

Write-Host "  jiang 不能标记自己的报备为已阅" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Post -Uri "$base/posts/$reportId/read" -Headers (Hdr $j.accessToken) -Body @{}
} 'E_POST_FORBIDDEN' 'self mark read'

Write-Host "  已阅后 unread filter 应该就不再返回这条" -ForegroundColor DarkGray
$r = Req -Method Get -Uri "$base/posts?type=report&filter=unread" -Headers (Hdr $m.accessToken)
if ($r.data.items | Where-Object { $_.id -eq $reportId }) { throw '已阅的报备仍出现在 unread 里' }

# ---------- 8. 评价 UPSERT ----------
Write-Host "`n== [8] meng 评价 jiang 的报备 ==" -ForegroundColor Cyan
$r = Req -Method Put -Uri "$base/posts/$reportId/evaluation" -Headers (Hdr $m.accessToken) -Body @{ text = '早点回来哦' }
Ok $r 'upsert evaluation'
$firstUpdatedAt = $r.data.updatedAt
if ($r.data.text -ne '早点回来哦') { throw "evaluation 写入乱码: $($r.data.text)" }

Start-Sleep -Milliseconds 1100
Write-Host "  再次 PUT 覆盖文本" -ForegroundColor DarkGray
$r = Req -Method Put -Uri "$base/posts/$reportId/evaluation" -Headers (Hdr $m.accessToken) -Body @{ text = '早点回来哦（改）' }
Ok $r 'upsert evaluation again'
if ($r.data.text -ne '早点回来哦（改）') { throw '评价未覆盖' }
if ($r.data.updatedAt -eq $firstUpdatedAt) { throw 'updatedAt 没推进' }

Write-Host "  jiang 评价自己的报备应被拒" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Put -Uri "$base/posts/$reportId/evaluation" -Headers (Hdr $j.accessToken) -Body @{ text = 'self comment' }
} 'E_EVAL_ONLY_PARTNER' 'self evaluation'

# ---------- 9. detail：评价内联返回 ----------
Write-Host "`n== [9] 详情接口带 evaluation ==" -ForegroundColor Cyan
$r = Req -Method Get -Uri "$base/posts/$reportId" -Headers (Hdr $j.accessToken)
Ok $r 'detail'
if (-not $r.data.evaluation) { throw 'evaluation 没内联' }
if ($r.data.evaluation.text -ne '早点回来哦（改）') { throw 'evaluation text 不对' }

# ---------- 10. 删除报备 + 删 tag ----------
Write-Host "`n== [10] 清理：删除报备 + 删 tag ==" -ForegroundColor Cyan
$r = Req -Method Delete -Uri "$base/posts/$reportId" -Headers (Hdr $j.accessToken)
Ok $r 'delete report'

$r = Req -Method Delete -Uri "$base/tags/$([uri]::EscapeDataString('看电影'))" -Headers (Hdr $j.accessToken)
Ok $r 'delete custom tag'

Write-Host "  preset tag 不可删" -ForegroundColor DarkGray
ExpectFail {
  Req -Method Delete -Uri "$base/tags/$([uri]::EscapeDataString('干饭'))" -Headers (Hdr $j.accessToken)
} 'E_TAG_PRESET_READONLY' 'delete preset tag'

Write-Host "`nALL SMOKE PASSED" -ForegroundColor Green
