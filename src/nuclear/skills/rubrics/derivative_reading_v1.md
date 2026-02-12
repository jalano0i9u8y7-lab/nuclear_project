# 衍生品解讀方法論 V1

## 數據來源原則
- DERIVATIVES_DAILY 為衍生品數據的唯一權威表
- D-3 和 P2.5 不自行重算衍生品指標，只做摘要與解讀
- 「量大於價」——期權量能比價格更能反映機構意圖

## 核心衍生品指標解讀框架

### Options
- **OI/Volume**：高 OI + 高 Volume = 新倉位建立；高 OI + 低 Volume = 持倉觀望
- **Put/Call Ratio**：極端值（>1.2 或 <0.5）可能為反向指標
- **IV (Implied Volatility)**：IV 暴增 = 市場預期大波動；IV crush = 事件結束
- **Skew**：負偏度加深 = 避險需求增加；正偏度 = 追高情緒
- **Term Structure**：近月 > 遠月（Backwardation）= 近期恐慌
- **GEX / Dealer Positioning**：
  - 正 GEX = Dealer 反向對沖壓制波動
  - 負 GEX = Dealer 順勢對沖放大波動

### DISTORTION_RISK 判斷 (§8.4.3)
判斷是否存在 gamma squeeze、ETF rebalance、槓桿 ETF 扭曲等非基本面驅動的價格行為。
- HIGH 時禁止高信心突破判定
- 輸出：NONE / LOW / MED / HIGH

### ICDZ 機構成本防守區 (§7.3.4)
- 主要依據：近 2 季 13F 加倉時段的 VWAP
- 輔助依據：Dark Pool 成交密集區
- confidence 三維度：數據完整性 40% + 機構一致性 30% + 價格驗證 30%

| Cat 狀態 | ICDZ 適用性 |
|----------|-----------|
| Cat 1 (Accumulation) | ✅ 高適用 |
| Cat 2 (Markup) | ✅ 中適用 |
| Cat 3 (Parabolic) | ❌ 不適用 |
| Cat 4 (Pullback) | ✅ 高適用 |
| Cat 5 (Markdown) | ⚠️ 低適用 |
