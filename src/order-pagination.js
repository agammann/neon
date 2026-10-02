export function createOrderPagination(readPage, showPage) {
  let page = 0, loading = false, hasMore = false;
  return {
    get page() { return page; },
    get loading() { return loading; },
    get hasMore() { return hasMore; },
    async load(requestedPage = page) {
      if (loading) return false;
      if (!Number.isSafeInteger(requestedPage) || requestedPage < 0) {
        throw new Error('Invalid order book page.');
      }
      loading = true;
      try {
        const data = await readPage(requestedPage);
        // Commit only validated responses. A failed fetch keeps the visible page.
        page = requestedPage;
        hasMore = Boolean(data.hasMore);
        await showPage(data, page);
        return true;
      } finally {
        loading = false;
      }
    },
  };
}
