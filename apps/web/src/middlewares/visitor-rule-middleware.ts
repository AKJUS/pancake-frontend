import { NextFetchEvent, NextResponse } from 'next/server'
import { ExtendedNextReq, MiddlewareFactory, NextMiddleware } from './types'

const CAKEPAD_HOST = 'cakepad.pancakeswap.finance'

export const visitorRedirectMiddleware: MiddlewareFactory = (next: NextMiddleware) => {
  return async (request: ExtendedNextReq, _next: NextFetchEvent) => {
    const visited = request.cookies.get('visited')
    const isCakepadHost = request.nextUrl.hostname === CAKEPAD_HOST

    if (isCakepadHost && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/cakepad'
      url.searchParams.set('chain', 'base')
      return NextResponse.rewrite(url)
    }

    if (visited) {
      if (!isCakepadHost && request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/swap', request.url))
      }
    } else {
      const response = NextResponse.next()
      response.cookies.set('visited', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      })
      return response
    }

    return next(request, _next)
  }
}
