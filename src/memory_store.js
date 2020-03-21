module.exports = class MemoryStore {
  constructor() {
    // [cookie key + cookie value] : {session 对象数据}
    this.sessions = {}
    this.timeouts = {}
  }

  get(sid) {
    return this.sessions[sid]
  }

  set(sid, val, ttl) {
    // 如果当前的 sid 的 session数据更新了, 需要重新计算过期值
    if (sid in this.timeouts) clearTimeout(this.timeouts[sid])

    this.sessions[sid] = val
    this.timeouts[sid] = setTimeout(() => {
      delete this.sessions[sid]
      delete this.timeouts[sid]
    }, ttl)
  }

  destroy(sid) {
    // 说明当前需要销毁的 session 数据存在 ssessions 中
    if (sid in this.timeouts) {
      clearTimeout(this.timeouts[sid])

      // 删除 定时器 和 session数据
      delete this.sessions[sid]
      delete this.timeouts[sid]
    }
  }
}
