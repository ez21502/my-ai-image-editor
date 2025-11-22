## 推广奖励规则
- 每个用户拥有专属邀请链接。
- 每成功邀请 1 个从未使用过本应用的新用户：邀请者 +1 算力点。
- 新用户首次进入应用：自动获得 +3 算力点。

## 邀请链接与参数
- 邀请链接格式：
  - 机器人深链：`https://t.me/<BOT_USERNAME>?start=ref_<inviter_id>`（用于聊天启动）。
  - Mini App 链接：`https://t.me/<BOT_USERNAME>/<mini_app>?startapp=ref_<inviter_id>`（用于直接打开 WebApp）。
- `start_param`/`startapp` 在 WebApp 的 `initData`/launch params 中可被读取；前端将 `startParam` 与 `initData` 一并传到后端接口。

## 数据库（Supabase）
- `user_credits(telegram_user_id bigint primary key, credits int not null default 0, updated_at timestamptz)`。
- `referrals(id uuid primary key, inviter_id bigint, invitee_id bigint, created_at timestamptz, unique(invitee_id))`（保证每个新用户仅记一次邀请）。

## 后端接口与逻辑（tg-stars-mini-app on Vercel）
### `GET /api/referral/link`
- 入参：`initData`；校验后返回用户专属邀请链接（两种格式皆可）。

### 新用户判定与奖励发放
- 触发时机：
  - `GET /api/balance` 的首次调用；或
  - `POST /api/webhook` 收到该用户的第一次交互（若适用）。
- 逻辑：
  - 校验 `initData` → 提取 `telegram_user_id` 与 `startParam`（如 `ref_<inviter_id>`）。
  - 查询 `user_credits` 是否存在：
    - 不存在 → 创建用户记录并加 +3 点。
    - 存在 → 不重复赠送。
  - 若 `startParam` 解析出有效 `inviter_id`，且 `invitee` 尚未登记在 `referrals`：
    - 记录一条 `referrals(inviter_id, invitee_id)`。
    - 为 `inviter_id` 加 +1 点。

### 其他接口保持不变
- `POST /api/create-invoice`：生成四档固定套餐的发票链接。
- `POST /api/webhook`：写入套餐加点。
- `GET /api/balance`：返回当前点数（并在首次时处理新用户赠送与邀请奖励）。
- `POST /api/consume`：扣 1 点并触发 Make Webhook。

## 前端改造
- 在用户信息区域提供“复制邀请链接”按钮：调用 `GET /api/referral/link` 并复制。
- `TMAProvider` 补充 launch params 提取，前端统一把 `initData` 与 `startParam` 传给后端（`frontend/src/hooks/useLaunchParams.ts` 已有 `startParam` 字段定义）。
- 重绘按钮保持新流程；余额显示与充值入口如前计划。

## 风险与校验
- 防刷：`unique(invitee_id)` 保证每个新用户只计一次邀请；首次赠送仅在用户首次出现时发生。
- 文案引导：邀请完成后提示奖励到账；新用户首次进入的欢迎赠送提示。

## 验证
- 场景：新用户携带 `ref_<inviter_id>` 进入 → 新用户 +3、邀请者 +1；重复进入不再加点。
- 套餐购买与扣点流程与邀请系统无冲突。

若确认，我将按此方案在后端实现邀请与首次赠送，并在前端接入邀请链接展示与参数透传，同时继续推进支付与扣点的联调。