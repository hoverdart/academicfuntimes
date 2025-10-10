import { NotionAPI } from 'notion-client'

const CUSTOM_API_BASE_URL = 'https://shauryav.notion.site/api/v3'

const primaryClient = new NotionAPI({
  apiBaseUrl: CUSTOM_API_BASE_URL
})

const fallbackClient = new NotionAPI()

const shouldLogFallback = process.env.NODE_ENV !== 'production'

async function tryWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    if (shouldLogFallback) {
      console.warn('[notion-api] primary client failed; falling back', err)
    }

    try {
      return await fallback()
    } catch (err) {
      if (shouldLogFallback) {
        console.error('[notion-api] fallback client failed', err)
      }

      throw err
    }
  }
}

export const notion = {
  getPage: async (
    ...args: Parameters<NotionAPI['getPage']>
  ) => {
    return tryWithFallback(
      () => primaryClient.getPage(...args),
      () => fallbackClient.getPage(...args)
    )
  },
  search: async (
    ...args: Parameters<NotionAPI['search']>
  ) => {
    return tryWithFallback(
      () => primaryClient.search(...args),
      () => fallbackClient.search(...args)
    )
  }
}
