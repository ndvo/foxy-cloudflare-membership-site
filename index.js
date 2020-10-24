/* global fetch, Response, HTMLRewriter, addEventListener, FX_REDIRECT,
  FX_OMIT, FX_JWT_SECRET
  */
const jwt = require('jsonwebtoken')

const FX_CUSTOMER_JWT_COOKIE = 'fx.customer.jwt'

/** Cloudflare Worker method */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Gets the cookie with given name from the request headers
 *
 * @param {Request} request incoming Request
 * @param {string} name of the cookie to get
 */
function getCookie (request, name) {
  let result = ''
  const cookieString = request.headers.get('Cookie')
  if (cookieString) {
    const cookies = cookieString.split(';')
    for (let c = 0; c < cookies.length; c += 1) {
      const cookie = cookies[c].split(';')
      if (name === cookie[0].trim()) {
        result = cookie[1]
        break
      }
    }
  }
  return result
}

/** A handler that removes any element it receives */
class OmitHandler {
  element (el) {
    if (FX_OMIT) el.remove()
  }
}

/** A handler that sets an attribute on itself 'login' to true if any
 * element is passed to it */
class LoginFormHandler {
  element (el) {
    if (el) this.login = true
  }
}

/**
 * Verify the request has a valid Customer Portal Foxy JWT
 *
 * @param {Request} request incoming Request
 * @return {payload} JWT payload or null if invalid or absent JWT
 */
function verify (request) {
  const jwtString = getCookie(request, FX_CUSTOMER_JWT_COOKIE)
  if (!jwtString) return false
  let payload
  try {
    payload = jwt.verify(jwtString, FX_JWT_SECRET)
  } catch (e) {
    payload = null
  }
  return payload
}

async function handleRequest (request) {
  const responsePromise = fetch(request)
  if (verify(request)) {
    // User is authenticated: nothing to do
    return responsePromise
  } else {
    const response = await responsePromise
    const loginHandler = new LoginFormHandler()
    const transformedResponse = new HTMLRewriter()
      .on('[data-login]', loginHandler)
      .on('[data-restricted]', new OmitHandler())
      .transform(response)
    if (!loginHandler.login && FX_REDIRECT) {
      return Response.redirect(FX_REDIRECT, 302)
    } else {
      return transformedResponse
    }
  }
}