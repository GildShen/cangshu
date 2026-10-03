# 藏書 Cangshu

Windows EPUB / PDF 閱讀器，提供書櫃分類、閱讀筆記、螢光筆與 AI 閱讀輔助。

## 功能

- 最近閱讀預設首頁、書名與作者搜尋、資料夾分類及拖曳整理。
- EPUB 原版閱讀、轉換網頁閱讀與匯出離線網頁 ZIP。
- PDF 頁面、目錄、縮圖、文字搜尋及旋轉；不包含 OCR。
- 字體、字級、行距、全螢幕與日夜模式。
- 螢光筆八種預設顏色及自訂顏色、閱讀筆記與位置跳轉。
- 桌面版支援 Codex CLI 或 OpenAI API：選取文字後翻譯、解釋、摘要，並可存成筆記。
- 顯示 AI 回報的單次 Token 用量；未回報時不以零代替。

## 安裝

從 [GitHub Releases](https://github.com/GildShen/cangshu/releases/latest) 下載 `Cangshu-Setup-<版本>.exe`，執行後依安裝精靈操作。發行頁另附 SHA-256 校驗檔與對應原始碼。

目前安裝檔未簽章，Windows 可能顯示未知發行者提示。程式不會自動接管預設檔案關聯，請在 Windows「預設應用程式」中自行選擇。

## 開發與建置

目前主要驗證平台為 Windows，開發環境使用 Node.js 24。

```powershell
cd desktop
npm ci
npm test
npm start
```

產生 Windows 安裝檔：

```powershell
npm run dist
```

輸出位於 `desktop-release/`。終端使用者安裝後不需要 Node.js。

靜態瀏覽器版可直接開啟 `ebook-browser/index.html`；AI 整合僅限桌面版。Webfont 使用 Google Fonts，首次載入需要網路，離線時使用本機備援字體。

## 資料與隱私

書籍與閱讀紀錄儲存在本機；本儲存庫不包含電子書、私人書庫或 API 金鑰。桌面資料位於 `%APPDATA%\CangshuReader`，備份前請關閉程式。

AI 功能會將選取的文字傳送至所選服務。OpenAI API 需自行提供金鑰並承擔服務費用；金鑰透過 Electron safeStorage 加密保存在本機，不會寫入原始碼。Codex CLI 需先安裝及登入。請只傳送你有權處理的內容。

PDF 掃描頁可閱讀，但未經 OCR 不提供文字選取或搜尋。DRM 電子書不受支援。轉換 EPUB 可能無法完整保留原始版面；可切回 EPUB 原版閱讀。

## 專案結構與測試

- `ebook-browser/`：HTML、CSS、JavaScript 閱讀器與第三方執行資源。
- `desktop/`：Electron、安全 IPC、AI 服務、打包設定與單元測試。
- `npm test`：在 `desktop/` 執行，不需要私人書籍或真實 API 金鑰。

開發期間另以私人測試書籍驗證 EPUB/PDF、筆記、標註與不同視窗尺寸；這些書籍、截圖及依賴它們的測試腳本不包含在公開儲存庫中。

## 授權

本專案採用 [MIT License](LICENSE)，允許使用、修改、散布與商業使用，須保留版權與授權聲明。第三方元件依各自授權提供，詳見 [第三方聲明](THIRD_PARTY_NOTICES.md)。AI 服務與你匯入的電子書不屬於本專案的授權範圍。
