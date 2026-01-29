# PC Inventory Master 软件开发文档（面向完全新人）

本文档目标：让**完全不了解系统的人**，通过一次通读就能理解：
- 这个系统解决什么问题
- 系统有哪些核心功能与关键业务规则
- 前端 / 后端 / 数据库如何协作
- 代码结构在哪里、从哪里开始读
- 如何在本地跑起来、如何验证修改是否安全
- 扩展功能时的正确姿势（尤其是写入链路与幂等性）

建议阅读顺序：
1. 先看「1. 系统定位与核心功能」
2. 再看「2. 一张图理解系统架构」
3. 接着看「3. 代码结构导览（从哪里开始读）」
4. 然后根据你的工作方向跳读前端 / 后端 / 数据模型章节

---

## 1. 系统定位与核心功能

这是一个面向装机业务的管理系统，核心覆盖三件事：
- 客户管理（Clients）
- 库存管理（Inventory）
- 入库单管理（Inbound Receipts）

系统的设计重点不是“炫技”，而是：
- 业务上可落地
- 写入安全（防重复、可追踪）
- 前端体验顺滑（乐观更新 + 写入队列）

### 1.1 客户管理（Clients）

主要能力：
- 客户列表查看与筛选
- 客户详情编辑（身份 / 物流 / 财务 / 配置清单）
- PCPartPicker 文本粘贴解析
- 财务衍生值自动计算（成本 / 利润 / 未结清金额）

关键业务规则（非常重要）：
- “草稿客户（draft）”只存在于内存中。
- 只有当 `wechatName` 从空变为非空时，才会把整份草稿正式写入数据库。
- 一旦写入数据库，后续编辑采用“写入队列 + 幂等 operationId”的方式异步提交。

对应实现位置：
- 草稿与提交规则：`client/src/features/clients/ClientsRoutes.tsx`
- 财务计算：`client/src/domain/client/client.logic.ts`
- 客户写入链路（写入队列 + 乐观更新）：`client/src/app/writeBehind/clientWriteBehind.ts`

### 1.2 库存管理（Inventory）

主要能力：
- 库存列表浏览与分类
- 行内编辑（名称 / SKU / 数量 / 成本 / 元数据等）
- 查看库存变动历史（movement ledger）
- 删除时的“引用保护”：如果该库存项被入库单引用，则不会硬删，而是归档

关键业务规则：
- 库存有“变动台账（inventory_movements）”，每次重要变更都会写入一条 movement。
- 成本采用“加权平均成本（weighted average cost）”。
- SKU 采用“非空时 lower(trim) 唯一”的规则。

对应实现位置：
- 前端库存页：`client/src/presentation/modules/Inventory/InventoryHub.tsx`
- 库存写入链路：`client/src/app/writeBehind/inventoryWriteBehind.ts`
- 后端库存服务：`server/services/inventoryService.js`
- movement 表写入：`server/repositories/movementRepo.js`

### 1.3 入库单（Inbound Receipts）

主要能力：
- 入库单列表
- 创建入库单（一次性接收入库条目）
- 入库单详情查看与编辑（包括图片与条目调整/删除）

关键业务规则：
- 创建入库单时，会：
1. 写入入库单头（receipt header）
2. 写入入库单行（receipt items）
3. 同步更新库存数量与加权成本
4. 写入 movement 台账与 audit log
- 这些动作在事务内完成，且受 operationId 幂等保护。

对应实现位置：
- 前端路由壳：`client/src/presentation/modules/Inbound/InboundHub.tsx`
- 创建/详情页：
1. `client/src/presentation/modules/Inbound/ReceiptCreate.tsx`
2. `client/src/presentation/modules/Inbound/ReceiptDetail.tsx`
- 后端服务：`server/services/inboundReceiptService.js`

---

## 2. 一张图理解系统架构

系统是一个小型 monorepo，运行时分为三个服务：
- 数据库：Postgres
- 后端：Node.js + Express
- 前端：React（CRA）+ React Query

在 Docker Compose 下的关系可以理解为：

```text
浏览器
  -> client (nginx / CRA dev server)
    -> /api/* 反向代理到 server
      -> server (Express)
        -> db (Postgres)
```

关键架构思想（请牢记这三条）：
- 前端写入不是“每次改字段就立刻打 API”，而是“写入队列（SaveQueue）+ 防抖 + 合并 patch + 乐观更新”。
- 后端写入不是“直接改表”，而是“事务 + 幂等键（operationId）+ movement 台账 + audit log”。
- 数据一致性依赖两侧配合：前端提供 operationId，后端用 `idempotency_keys` 护栏防重复。

---

## 3. 代码结构导览（从哪里开始读）

### 3.1 根目录结构（最重要的入口）

建议优先关注这些文件：
- 总入口说明：`README.md`
- 架构简述：`docs/ARCHITECTURE.md`
- 开发方式：`docs/DEVELOPMENT.md`
- 生产/开发编排：
1. `docker-compose.yml`
2. `docker-compose.dev.yml`
- 一键开发命令：`mk.sh`
- 验证脚本：`scripts/verify.sh`

### 3.2 前端入口（React）

从这条链开始读最顺：
1. React 挂载入口：`client/src/index.js`
2. 应用入口：`client/src/App.tsx`
3. 全局 Provider 装配：`client/src/app/providers/AppProviders.tsx`
4. 路由与页面：`client/src/AppRouter.tsx`
5. 客户核心逻辑：`client/src/features/clients/ClientsRoutes.tsx`

### 3.3 后端入口（Express）

后端几乎所有关键逻辑都从这里入手：
- 入口与路由：`server/index.js`

然后按分层继续看：
- 服务层（业务事务逻辑）：`server/services/*.js`
- 仓储层（纯 SQL / 表操作）：`server/repositories/*.js`
- 事务工具：`server/db/tx.js`
- 迁移工具：`server/db/migrate.js`
- 迁移 SQL（真正的 schema 来源）：`server/db/migrations/*.sql`

---

## 4. 运行方式与环境配置

本项目推荐用 Docker Compose 作为标准运行方式。

### 4.1 开发模式（热更新，推荐）

命令：

```bash
./mk.sh dev
```

实际执行的是：
- `docker-compose.yml` + `docker-compose.dev.yml` 叠加
- 后端使用 `node --watch index.js`
- 前端使用 CRA dev server

端口：
- 前端：`http://localhost:8090`
- 后端：`http://localhost:5001/api/health`
- 数据库：`localhost:5433`

相关文件：
- `mk.sh`
- `docker-compose.yml`
- `docker-compose.dev.yml`

### 4.2 生产风格模式（构建后由 nginx 提供前端）

命令：

```bash
docker compose up -d --build
```

此模式下：
- 前端会先 build，再由 nginx 提供静态资源
- `/api` 由 nginx 反向代理给 server

相关文件：
- `client/Dockerfile`
- `client/nginx.conf`
- 根目录 `nginx.conf`（备用配置）

### 4.3 环境变量

示例文件：`.env.example`

最关键变量：
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SEED`（是否注入演示数据）
- `STARTUP_CLEANUP`（是否在启动时做一次性清理，默认不建议开启）

后端连接数据库时的默认值定义在：`server/index.js`

---

## 5. 数据模型（数据库表与它们的职责）

本系统的数据模型不复杂，但“写入链路很讲究”。

### 5.1 clients（客户主表）

用途：存客户、订单、配置、财务等信息。

关键字段（概念层面）：
- 身份相关：`wechat_name`、`wechat_id`、`real_name` 等
- 订单/物流：`order_date`、`delivery_date`、`status`、`tracking_number`
- 财务：`total_price`、`actual_cost`、`profit`、`paid_amount`
- 配置清单：`specs`（JSONB object）
- 图片：`photos`（JSONB array）
- 扩展字段：`metadata`（JSONB object）

注意：
- `order_date` 被视为关键字段，后端会校验它必须是 `YYYY-MM-DD`。
- 财务字段有非负约束（但 profit 允许为负或 null）。

表定义来源：
- 基线：`server/db/migrations/000_init_schema.sql`
- 约束调整：`server/db/migrations/004_relax_profit_check.sql`

### 5.2 inventory（库存主表）

用途：存储库存项与当前库存状态（数量 / 成本 / 状态等）。

关键点：
- `quantity` 与 `cost` 是库存状态的核心。
- 成本采用“加权平均成本”，由服务层统一计算。
- SKU 的唯一性规则是“非空时 lower(trim) 唯一”。

SKU 规则对应迁移：`server/db/migrations/002_schema_align_indexes_constraints.sql`

### 5.3 inventory_movements（库存变动台账）

用途：作为库存变动的“账本（ledger）”，记录每次变动后的结果状态。

你可以把它理解成：
- inventory 是“当前余额”
- movements 是“流水明细”

典型字段含义：
- `qty_delta`：本次变动数量（正入库 / 负出库 / 调整）
- `reason`：原因（RECEIVE / CONSUME / ADJUST / OPENING）
- `on_hand_after`：变动后库存数量
- `avg_cost_after`：变动后平均成本
- `operation_id`：幂等键（唯一）

来源迁移：`server/db/migrations/005_add_inventory_movements.sql`

### 5.4 inbound_receipts / inbound_receipt_items（入库单）

用途：记录入库单头与入库单行。

关键点：
- 入库单不是“只记账”，它会驱动库存更新。
- 入库单行引用 inventory，删除库存时会受引用保护。

来源迁移：
- 入库单表：`server/db/migrations/006_add_inbound_receipts.sql`
- 入库单图片：`server/db/migrations/007_add_receipt_images.sql`

### 5.5 idempotency_keys（幂等保护表）

用途：保障关键写入接口“不会因为重试 / 重放而重复生效”。

机制简述：
- 前端传 `operationId`
- 后端先尝试 insert 一条 IN_PROGRESS
- 如果发现已 DONE，直接返回之前的 response
- 成功后标记 DONE 并保存 response

来源迁移：`server/db/migrations/003_add_idempotency_keys.sql`

---

## 6. 后端设计（Express + 事务 + 幂等）

后端的核心价值不在“路由有多少”，而在“写入是否可靠”。

### 6.1 后端启动流程（非常关键）

启动主流程在：`server/index.js`

顺序大致是：
1. `waitForDb()`：等待数据库可连接
2. `initDB()`：基线建表（兜底）
3. `runMigrations(pool)`：执行迁移（schema 来源）
4. `startupCleanupIfEnabled()`：可选清理
5. `seedIfEnabled()`：可选种子数据
6. `app.listen(PORT)`：启动服务

非常重要的现实情况：
- 当前系统同时存在 `initDB()` 与 migrations。
- 真实的 schema 演进应以 `server/db/migrations/*.sql` 为准。

### 6.2 后端分层方式（建议的阅读模型）

可以把后端理解为三层：
- 路由层：参数接收 + 调用服务
- 服务层：业务规则 + 事务 + 幂等
- 仓储层：SQL 细节与表操作

对应目录：
- 路由：`server/index.js`
- 服务：`server/services/*.js`
- 仓储：`server/repositories/*.js`

### 6.3 写入链路的标准姿势（强烈建议复用）

在库存与入库单中，写入遵循统一套路：
1. 校验输入（缺 operationId 直接报错）
2. 开启事务：`withTransaction()`（`server/db/tx.js`）
3. 调用 `idempotencyRepo.beginOperation()`
4. 读取并加锁：`SELECT ... FOR UPDATE`
5. 计算变更（数量 / 成本 / 台账）
6. 写入主表
7. 写入 movement 台账
8. 写入 audit log
9. `idempotencyRepo.markDone()`

你可以直接参考：
- 库存批量：`server/services/inventoryService.js`
- 入库单创建/编辑：`server/services/inboundReceiptService.js`

### 6.4 统一错误契约（前后端对齐的关键）

错误处理中间件在：`server/middleware/errorHandler.js`

后端的错误返回结构统一为：

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "Validation failed",
    "retryable": false,
    "requestId": "...",
    "details": {}
  }
}
```

关键点：
- `requestId` 来自：`server/middleware/requestId.js`
- 常见 PG 错误会被映射为业务错误：`server/errors/pg.js`

---

## 7. API 总览（从产品视角理解接口）

所有接口都挂在 `/api` 下。

### 7.1 健康检查

- `GET /api/health`

### 7.2 仪表盘

- `GET /api/dashboard/stats`
- `POST /api/dashboard/profit`

### 7.3 客户

- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`（upsert）
- `DELETE /api/clients/:id`

重要约束：
- `POST /api/clients` 会强校验：
1. `id` 必须存在
2. `wechatName` 必须非空
3. `orderDate` 必须是 `YYYY-MM-DD`

### 7.4 库存

- `GET /api/inventory`
- `GET /api/inventory/:id/movements`
- `POST /api/inventory/batch`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`

重要约束：
- `POST /api/inventory/batch` 与 `PUT /api/inventory/:id` 要求 `operationId`。
- 删除库存时，如果被入库单引用，不会硬删，而是归档（status=Archived, quantity=0）。

### 7.5 入库单

- `GET /api/inbound/receipts`
- `GET /api/inbound/receipts/:id`
- `POST /api/inbound/receipts`
- `PATCH /api/inbound/receipts/:id`
- `DELETE /api/inbound/receipts/:id`

重要约束：
- 创建入库单必须带 `operationId`。
- 入库单编辑会影响库存数量与成本（并写 movement）。

### 7.6 其他

- `GET /api/lookup/:code`（条码查询 + 本地缓存）
- `GET /api/logs`
- `POST /api/logs`（带 operationId）

---

## 8. 前端设计（React Query + 写入队列 + 乐观更新）

如果你只记住一句话，请记住这一句：

> 前端的“写入体验”是靠 SaveQueue 和 write-behind 组合实现的。

### 8.1 前端总体结构

关键装配点：
- Provider 装配：`client/src/app/providers/AppProviders.tsx`
- 路由装配：`client/src/AppRouter.tsx`
- 页面模块：`client/src/presentation/modules/*`

AppProviders 里依次挂载了：
- React Query：`QueryClientProvider`
- SaveQueue：`SaveQueueProvider`
- 确认弹窗：`ConfirmProvider`
- beforeunload 守卫：当有未完成写入时阻止误关闭

### 8.2 查询层（React Query）

查询封装位置：`client/src/app/queries/*`

常用查询：
- 客户：`client/src/app/queries/clients.ts`
- 库存：`client/src/app/queries/inventory.ts`
- 入库单：`client/src/app/queries/receipts.ts`

这些查询使用统一的严格 API：`apiCallOrThrow`（`client/src/utils.ts`）。

### 8.3 写入队列 SaveQueue（系统的关键基础设施）

实现位置：
- 队列核心：`client/src/app/saveQueue/SaveQueue.ts`
- Provider：`client/src/app/saveQueue/SaveQueueProvider.tsx`
- UI 状态提示：`client/src/app/saveQueue/SyncStatusPill.tsx`

SaveQueue 的职责：
- 合并同一 key 的 patch
- 防抖写入
- 统一处理 in-flight / 错误 / 重试
- 产生 operationId，传递给后端做幂等保护

非常重要的行为：
- 对“不可重试错误（例如 4xx 校验失败）”，队列会“粘住错误”，直到用户修复输入并重试。

### 8.4 Write-behind（乐观更新 + 队列写入）

Write-behind 封装位置：`client/src/app/writeBehind/*`

核心思想：
- 先更新缓存（乐观更新，界面立即变）
- 再把 patch 投递进 SaveQueue
- SaveQueue 延迟/合并后，调用真实 API

典型实现：
- 客户：`client/src/app/writeBehind/clientWriteBehind.ts`
- 库存：`client/src/app/writeBehind/inventoryWriteBehind.ts`
- 入库单创建：`client/src/app/writeBehind/receiptWriteBehind.ts`

### 8.5 “草稿客户”工作流（理解客户模块的关键）

实现位置：`client/src/features/clients/ClientsRoutes.tsx`

关键规则再次强调：
- 草稿只存在内存，不进数据库。
- `wechatName` 是“草稿转正式”的开关。
- 这个机制可以避免产生“幽灵客户记录”。

当你修改客户写入相关逻辑时，请优先保护这一规则。

### 8.6 不使用浏览器原生 confirm/alert

系统约定统一使用：
- `useConfirm()`
- `useAlert()`

实现位置：`client/src/app/confirm/ConfirmProvider.tsx`

这样可以保证 UI 风格一致，也方便后续统一增强交互体验。

---

## 9. 写入安全的“双保险”：SaveQueue + 幂等键

这是本系统最值得珍惜的设计资产。

可以把它理解成：
- 前端保险：SaveQueue 避免“每次输入都打 API”，并控制重试行为
- 后端保险：operationId + `idempotency_keys` 避免“重复写入生效两次”

### 9.1 一个完整写入的实际路径（以库存更新为例）

链路如下：
1. 用户编辑库存字段
2. `useInventoryWriteBehind().update()` 先乐观更新缓存
3. patch 进入 SaveQueue（key 类似 `inventory:{id}`）
4. SaveQueue 生成 operationId
5. SaveQueue 调用 `PUT /api/inventory/:id`
6. 后端：
1. `idempotencyRepo.beginOperation()`
2. `SELECT ... FOR UPDATE`
3. 更新 inventory
4. 插入 inventory_movements
5. 插入 audit_logs
6. `idempotencyRepo.markDone()`

对应关键代码路径：
- 前端入口：`client/src/app/writeBehind/inventoryWriteBehind.ts`
- 队列核心：`client/src/app/saveQueue/SaveQueue.ts`
- 后端服务：`server/services/inventoryService.js`
- 幂等仓储：`server/repositories/idempotencyRepo.js`

### 9.2 你在扩展写入接口时的最低标准

强烈建议照抄现有模式：
- 必须要求 operationId
- 必须在事务内执行
- 必须考虑幂等重复提交
- 如果会影响库存状态，必须写 movement

---

## 10. 常见开发任务的落地指南

这一节是给“要动手改功能的人”的。

### 10.1 新增一个后端写入接口（推荐模板）

建议步骤：
1. 在 `server/services/` 新建或扩展服务函数
2. 在服务函数内使用 `withTransaction()`
3. 加入 operationId 校验
4. 接入 `idempotencyRepo.beginOperation()` / `markDone()`
5. 需要时写 movement / audit log
6. 最后在 `server/index.js` 挂路由

参考范例：
- `server/services/inventoryService.js`
- `server/services/inboundReceiptService.js`

### 10.2 新增一个前端写入动作（推荐模板）

建议步骤：
1. 先考虑是否需要 write-behind（大多需要）
2. 在 `client/src/app/writeBehind/` 增加封装
3. 先做乐观更新，再 enqueue
4. 在 enqueue 的 `write()` 里调用 `apiCallOrThrow`
5. 确保把 `operationId` 透传给后端

参考范例：
- `client/src/app/writeBehind/clientWriteBehind.ts`
- `client/src/app/writeBehind/inventoryWriteBehind.ts`

### 10.3 新增或修改数据库结构（唯一推荐方式）

不要只改 `initDB()`。

正确做法：
1. 在 `server/db/migrations/` 新增一个 `.sql` 迁移文件
2. 保持“可重复执行（idempotent）”
3. 通过 Docker 启动让 `runMigrations()` 自动执行

迁移执行器位置：`server/db/migrate.js`

### 10.4 如何快速判断“写入为什么没成功”

建议排查顺序：
1. 看前端右上角的同步状态提示（`SyncStatusPill`）
2. 打开浏览器网络面板，确认是否有请求发出
3. 看后端日志（Compose logs）里是否有带 requestId 的错误
4. 如果是 4xx，多半是校验失败（例如缺 operationId 或字段格式不对）

关键位置：
- 同步状态 UI：`client/src/app/saveQueue/SyncStatusPill.tsx`
- 后端错误收口：`server/middleware/errorHandler.js`

---

## 11. 验证与质量保障（如何确认改动没把系统搞坏）

这个项目已经内置了一套“偏实战”的验证链路。

### 11.1 一条命令的全量验证

在仓库根目录执行：

```bash
npm run verify
```

它会做这些事：
- 前端：`npm ci`、typecheck、test、build
- 后端：`npm ci`（以及可选的 typecheck/test/build）
- Docker build
- 烟雾测试（smoke test）

入口脚本：`scripts/verify.sh`

### 11.2 烟雾测试在测什么

脚本位置：`scripts/smoke.sh`

主要验证：
- `/api/health` 能通
- `/api/clients` 能通
- 一个不存在的客户接口会返回 404
- 前端首页可访问

这套检查很适合在“改了写入链路或编排配置”之后跑一遍。

---

## 12. 你需要知道的几个现实注意点（很重要）

这些不是“理论”，而是“踩坑总结”。

### 12.1 initDB 与 migrations 同时存在

现状：
- `server/index.js` 里有 `initDB()`
- 同时也有 `runMigrations()`

建议理解方式：
- migrations 才是 schema 的真实来源
- `initDB()` 更像兜底与历史兼容

因此：
- 涉及结构演进时，请优先写迁移 SQL：`server/db/migrations/*.sql`

### 12.2 operationId 不是可选项（对关键写入）

在库存、入库单、日志等关键写入中：
- operationId 是强依赖
- 没有 operationId，后端会直接拒绝请求

好消息是：
- 只要你走 SaveQueue / write-behind，operationId 会自动生成

### 12.3 SaveQueue 的“错误粘性”是设计的一部分

当后端返回不可重试错误时：
- SaveQueue 会保持错误状态
- 直到用户修复输入并重试

这不是 bug，而是为了避免“坏请求自动重试造成更多破坏”。

---

## 13. 关键文件速查表（给第一次接手的人）

如果你只能记住少量文件，请优先记住这些：

后端关键文件：
- 入口与路由：`server/index.js`
- 库存服务：`server/services/inventoryService.js`
- 入库单服务：`server/services/inboundReceiptService.js`
- 幂等仓储：`server/repositories/idempotencyRepo.js`
- 事务工具：`server/db/tx.js`
- 迁移执行器：`server/db/migrate.js`
- 迁移 SQL：`server/db/migrations/000_init_schema.sql`

前端关键文件：
- Provider 装配：`client/src/app/providers/AppProviders.tsx`
- 路由装配：`client/src/AppRouter.tsx`
- 客户核心工作流：`client/src/features/clients/ClientsRoutes.tsx`
- 写入队列核心：`client/src/app/saveQueue/SaveQueue.ts`
- 客户写入封装：`client/src/app/writeBehind/clientWriteBehind.ts`
- 库存写入封装：`client/src/app/writeBehind/inventoryWriteBehind.ts`
- 严格 API 调用：`client/src/utils.ts`

编排与验证：
- 编排：`docker-compose.yml`
- 开发编排覆盖：`docker-compose.dev.yml`
- 开发入口：`mk.sh`
- 全量验证：`scripts/verify.sh`
- 烟雾测试：`scripts/smoke.sh`

---

## 14. 推荐的阅读路径（不同角色版本）

### 14.1 如果你是前端工程师

推荐顺序：
1. `client/src/App.tsx`
2. `client/src/app/providers/AppProviders.tsx`
3. `client/src/AppRouter.tsx`
4. `client/src/features/clients/ClientsRoutes.tsx`
5. `client/src/app/saveQueue/SaveQueue.ts`
6. `client/src/app/writeBehind/*.ts`

### 14.2 如果你是后端工程师

推荐顺序：
1. `server/index.js`
2. `server/services/inventoryService.js`
3. `server/services/inboundReceiptService.js`
4. `server/repositories/*.js`
5. `server/db/migrations/*.sql`

### 14.3 如果你是全栈 / 负责人

推荐顺序：
1. `docker-compose.yml`
2. `server/index.js`
3. `client/src/features/clients/ClientsRoutes.tsx`
4. `client/src/app/saveQueue/SaveQueue.ts`
5. `server/services/inventoryService.js`
6. `server/db/migrations/005_add_inventory_movements.sql`

---

## 15. 结语：这个系统最值得保护的三件事

如果你后续要持续演进这个系统，请优先保护这三点：

- 客户草稿转正式的规则（`wechatName` 触发落库）
- 写入队列 + 幂等键这条双保险链路
- 库存变动一定留痕（movement ledger）

只要这三件事不被破坏，系统就很难“悄悄变坏”。

