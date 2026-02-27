import { NotionAPI } from 'notion-client'
import { type ExtendedRecordMap } from 'notion-types'

const CUSTOM_API_BASE_URL = 'https://shauryav.notion.site/api/v3'

const primaryClient = new NotionAPI({
  apiBaseUrl: CUSTOM_API_BASE_URL
})

const fallbackClient = new NotionAPI()

const shouldLogFallback = process.env.NODE_ENV !== 'production'

type RecordMapTableEntry = {
  role?: string
  value?: any
}

type RecordMapTable = Record<string, RecordMapTableEntry>

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

function normalizeRecordMapTable(
  table: RecordMapTable | undefined
): RecordMapTable | undefined {
  if (!table) {
    return table
  }

  let changed = false
  const normalizedTable: RecordMapTable = {}

  for (const [id, entry] of Object.entries(table)) {
    const nestedEntry = entry?.value
    const nestedValue = nestedEntry?.value

    const shouldUnwrap =
      nestedEntry &&
      typeof nestedEntry === 'object' &&
      nestedValue &&
      typeof nestedValue === 'object' &&
      (typeof nestedValue.id === 'string' || typeof nestedValue.type === 'string')

    if (shouldUnwrap) {
      changed = true

      normalizedTable[id] = {
        ...entry,
        role: entry?.role ?? nestedEntry?.role,
        value: nestedValue
      }
    } else {
      normalizedTable[id] = entry
    }
  }

  return changed ? normalizedTable : table
}

function normalizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const block = normalizeRecordMapTable(recordMap?.block as RecordMapTable)
  const collection = normalizeRecordMapTable(
    recordMap?.collection as RecordMapTable
  )
  const collectionView = normalizeRecordMapTable(
    recordMap?.collection_view as RecordMapTable
  )
  const notionUser = normalizeRecordMapTable(
    recordMap?.notion_user as RecordMapTable
  )

  if (
    block === recordMap?.block &&
    collection === recordMap?.collection &&
    collectionView === recordMap?.collection_view &&
    notionUser === recordMap?.notion_user
  ) {
    return recordMap
  }

  return {
    ...recordMap,
    block: block as any,
    collection: collection as any,
    collection_view: collectionView as any,
    notion_user: notionUser as any
  }
}

export const notion = {
  getPage: async (
    ...args: Parameters<NotionAPI['getPage']>
  ) => {
    const recordMap = await tryWithFallback(
      () => primaryClient.getPage(...args),
      () => fallbackClient.getPage(...args)
    )

    return normalizeRecordMap(recordMap)
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
