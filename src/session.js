const uid = require('uid-safe')
const deepEqual = require('deep-equal')
const Store = require('./store')
const MemoryStore = require('./memory_store')

const ONE_DAY = 24 * 3600 * 1000 // one day in milliseconds

const cookieOpt = (cookie, ctx) => {
  const obj = cookie instanceof Function ? cookie(ctx) : cookie
  const options = Object.assign({
    maxAge: 0, // default to use session cookie
    path: '/',
    httpOnly: true,
  }, obj || {}, {
    overwrite: true, // overwrite previous session cookie changes
    signed: false, // disable signed option
  })
  if (!(options.maxAge >= 0)) options.maxAge = 0
  return options
}

const deleteSession = (ctx, key, cookie, store, sid) => {
  const tmpCookie = Object.assign({}, cookie)
  delete tmpCookie.maxAge
  ctx.cookies.set(key, null, tmpCookie)
  store.destroy(`${key}:${sid}`)
}

const saveSession = (ctx, key, cookie, store, sid) => {
  const ttl = cookie.maxAge > 0 ? cookie.maxAge : ONE_DAY
  ctx.cookies.set(key, sid, cookie)
  store.set(`${key}:${sid}`, ctx.session, ttl)
}

const cleanSession = (ctx) => {
  if (!ctx.session || typeof ctx.session !== 'object') ctx.session = {}
}

module.exports = (options) => {
  const opt = options || {}
  const key = opt.key || 'koa:sess'

  /**
   * store
   *  - get()
   *  - set()
   *  - destory()
   */
  const store = new Store(opt.store || new MemoryStore())
  const getCookie = ctx => cookieOpt(opt.cookie, ctx)

  return async (ctx, next) => {
    // initialize session id and data
    const oldSid = ctx.cookies.get(key)

    // 当前请求客户端携带的 cookie key
    let sid = oldSid

    // 重新生成 sid
    const regenerateId = () => {
      sid = uid.sync(24)
    }

    // 当初始 sid 不存在, 说明服务端没有存储 session
    // 进行 session 对象初始化
    // ctx 请求和相应上下文对象, 不同的用户请求会创建不同的上下文对象
    if (!sid) {
      regenerateId()
      ctx.session = {}
    } else {
      // sessions 内部 k 的格式为 "cookie key" + "cookie 的值"
      ctx.session = await store.get(`${key}:${sid}`)
      cleanSession(ctx)
    }

    // 保存一份旧的 session 数据
    const oldData = JSON.parse(JSON.stringify(ctx.session))

    // expose session handler to ctx
    // 对外提供一个 regenerateId 方法, 重新生成 sid 标识
    ctx.sessionHandler = {
      regenerateId,
    }

    await next()

    cleanSession(ctx)
    // 如果用户设置了 session数据
    const hasData = Object.keys(ctx.session).length > 0

    if (sid === oldSid) { // session id not changed
      if (deepEqual(ctx.session, oldData)) return // session data not changed

      const cookie = getCookie(ctx)
      const action = hasData ? saveSession : deleteSession
      action(ctx, key, cookie, store, sid) // update or delete the existing session
    } else { // session id changed
      // 第一次初始化的时候 sid 为最新值, oldSid的值为 null
      // 初始化 cookie 的配置项(options)
      const cookie = getCookie(ctx)

      // 什么情况下oldSid存在呢?
      // 当用户手动调用 ctx.sessionHandler.regenerateId() 方法更新内部的 sid
      // 从仓库中删除oldSid对应的session信息
      if (oldSid) deleteSession(ctx, key, cookie, store, oldSid) // delete old session

      // 如果新设置了数据, 进行存储
      if (hasData) saveSession(ctx, key, cookie, store, sid) // save new session
    }
  }
}
