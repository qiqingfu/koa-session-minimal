const co = require('co')

module.exports = class Store {
  constructor(store) {
    this.store = store
  }

  get(sid) {
    // co Generator 自动执行器
    // 一个异步操作的容器, 所以 get、set、destory方法内部可以直接使用 yield命令, 开启协程
    return co(this.store.get(sid))
  }

  set(sid, val, ttl) {
    return co(this.store.set(sid, val, ttl))
  }

  destroy(sid) {
    return co(this.store.destroy(sid))
  }
}
