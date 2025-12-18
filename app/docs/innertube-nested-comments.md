# YouTube Innertube API 嵌套留言與實體架構分析

**文件版本：** 1.0
**日期：** 2025-12-18
**文件類型：** 技術分析與遷移指南

---

## 1. 核心變更概述

YouTube 的留言系統正在從傳統的「渲染器直接包含資料」模式，轉向「渲染器與實體分離 (Entity-driven)」的架構，並引入了真正的嵌套回覆（回覆的回覆）。

### 主要變更點：
- **資料與渲染分離 (FrameworkUpdates)**：`commentViewModel` 渲染器不再直接包含留言文字，而是持有 `commentKey`。實際的留言內容存放在 `frameworkUpdates.entityBatchUpdate.mutations` 中。
- **嵌套回覆 (Nested Replies)**：回覆結構由原本的單層列表轉變為透過 `subThreads` 進行遞迴組織。
- **層級標記 (Reply Level)**：實體資料中現在包含 `replyLevel` 欄位，用以標示留言的深度。

---

## 2. 資料格式範例

### A. UI 渲染器結構 (`v1/next` 回應)
在 `onResponseReceivedEndpoints` 的 `continuationItems` 中，留言現在以 `commentViewModel` 的形式呈現。

```json
{
  "commentThreadRenderer": {
    "comment": {
      "commentViewModel": {
        "commentKey": "comment-entity-root-123", // 用於在 frameworkUpdates 中查找
        "rendererContext": { ... },
        "replyLevel": 0
      }
    },
    "replies": {
      "commentRepliesRenderer": {
        "contents": [ ... ],
        "subThreads": [ // 新增：嵌套回覆容器
          {
            "commentRepliesRenderer": {
              "contents": [
                {
                  "commentViewModel": {
                    "commentKey": "comment-entity-child-456",
                    "replyLevel": 1
                  }
                }
              ],
              "continuations": [ ... ] // 嵌套層級的分頁令牌
            }
          }
        ]
      }
    }
  }
}
```

### B. 實體資料結構 (`frameworkUpdates`)
實際內容必須透過 `commentKey` 從此區塊提取。

```json
{
  "frameworkUpdates": {
    "entityBatchUpdate": {
      "mutations": [
        {
          "entityKey": "comment-entity-child-456",
          "payload": {
            "commentEntityPayload": {
              "properties": {
                "content": {
                  "content": "這是一則嵌套回覆的內容文字"
                },
                "publishedTimeText": "1 小時前",
                "replyLevel": 1
              },
              "author": {
                "displayName": "使用者名稱",
                "avatar": { ... }
              },
              "toolbar": {
                "likeCountNotliked": "5",
                "replyCount": "2"
              }
            }
          }
        }
      ]
    }
  }
}
```

---

## 3. 遷移實作建議

### I. 遞迴處理 `subThreads`
目前的 `pipeline.ts` 只處理一層回覆。
- **建議**：重構 `migrateContinuationItemsWithFW` 函數，使其能夠遞迴掃描 `subThreads` 陣列，並將所有發現的留言物件平坦化或保留層級資訊存入 `CommentItem`。

### II. 建立實體快取映射 (Mutation Map)
由於 API 分離了渲染器與資料，單純遍歷 `continuationItems` 是不夠的。
- **建議**：在處理回應的最開始，先將 `frameworkUpdates.entityBatchUpdate.mutations` 轉換為一個以 `entityKey` 為索引的 `Map`。

### III. 更新 `CommentItem` 介面
- **建議**：在 `i_types.ts` 中的 `CommentItem` 介面新增 `replyLevel?: number` 欄位，這對於後續 UI 渲染縮排邏輯非常重要。

### IV. 分頁令牌提取
嵌套留言的分頁令牌 (Continuation tokens) 可能出現在每個 `subThreads` 層級。
- **建議**：更新 `extractReplyContinuationFromItem`，使其支援深度搜尋 nested continuations。

---

## 4. 相關技術文件

- [Innertube Comments Integration](./innertube-comments-integration.md)
- [Innertube Migration Guide](./innertube-migration-guide.md)
- [Continuation Processing](./continuation-processing.md)
