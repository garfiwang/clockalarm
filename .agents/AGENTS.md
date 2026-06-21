# 專案特定規則 (Project-Scoped Rules)

## 📌 GitHub 版本發布規則 (Versioning Requirement)
- **規則要求**：未來每次將新檔案或修改上傳（push）至此 GitHub 儲存庫（garfiwang/clockalarm）時，都必須進行版本編號。
- **發布流程**：
  1. 提交修改（Commit）並推送（Push）到 `main` 分支。
  2. 決定新的版本號（Semantic Versioning, 例如 `v1.0.1`, `v1.1.0` 等）。
  3. 使用 GitHub CLI 建立對應的版本標籤與正式 Release（發布附帶更新說明的日誌）：
     ```bash
     GITHUB_TOKEN="" gh release create <version> --title "<version> - <summary>" --notes "<changelog>"
     ```
