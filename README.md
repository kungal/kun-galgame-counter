# kun-galgame-counter

鲲 Galgame 的**临时下线维护页**，外加一个「莲可不可爱」的投票计数器。

网站维护期间，所有路径都会渲染这个页面并返回 HTTP `503 Service Unavailable` +
`Retry-After`，这样搜索引擎会把停机当作临时状态，而不会取消收录真正的站点。

- 框架：[Nuxt 4](https://nuxt.com)（SSR）+ Nitro server routes
- 部署：[pm2](https://pm2.keymetrics.io)，监听端口 `2326`
- 投票数据：持久化到本地 JSON 文件（`server/data/counter.json`）

## 投票计数器

访客可以为莲投出一票，三选一：

| 选项       | value      |
| ---------- | ---------- |
| 可爱       | `cute`     |
| 萌         | `adorable` |
| 又可爱又萌 | `both`     |

去重按来源 IP 进行，**每个 IP 只能投一次**。IP 不会以明文存储 —— 只保存
`sha256(salt + ip)` 的哈希，用于判重。盐值可通过环境变量
`COUNTER_IP_SALT` 覆盖（不设置时使用内置默认值）。

并发投票通过一个进程内写锁串行化读-改-写，避免同时点击时丢票。
注意：这依赖单进程运行（pm2 `instances: 1`）。若要横向扩容到多实例，
需要把存储换成 Redis 之类的共享后端。

### API

`/api/counter`

- **GET** —— 返回当前计数与本 IP 的投票状态：

  ```jsonc
  {
    "total": 42,
    "options": { "cute": 20, "adorable": 10, "both": 12 },
    "clicked": false,   // 本 IP 是否已投过
    "selected": null    // 本 IP 投的选项（未投则为 null）
  }
  ```

- **POST** `{ "option": "cute" | "adorable" | "both" }` —— 投票，返回与 GET 相同的结构。
  已投过的 IP 不会重复计数，会原样返回其先前的选择。

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## 构建与部署

```bash
pnpm build        # 产物输出到 .output/
pnpm start        # 用 pm2 启动（ecosystem.config.cjs，端口 2326）
pnpm stop         # 停止并从 pm2 删除
```

`server/data/counter.json` 是运行时数据，已被 `.gitignore` 忽略，不会提交进仓库；
首次写入时会自动创建。
