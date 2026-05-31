const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Dashboard
  dashboardStats: () => req('GET', '/dashboard/stats'),
  dashboardMonthly: () => req('GET', '/dashboard/monthly'),

  // Inventory
  getItems: () => req('GET', '/inventory/'),
  createItem: (data) => req('POST', '/inventory/', data),
  updateItem: (id, data) => req('PATCH', `/inventory/${id}`, data),
  deleteItem: (id) => req('DELETE', `/inventory/${id}`),

  // Listings
  getListings: () => req('GET', '/listings/'),
  createListing: (data) => req('POST', '/listings/', data),
  updateListing: (id, data) => req('PATCH', `/listings/${id}`, data),
  deleteListing: (id) => req('DELETE', `/listings/${id}`),

  // Sales
  getSales: () => req('GET', '/sold/'),
  createSale: (data) => req('POST', '/sold/', data),
  updateSale: (id, data) => req('PATCH', `/sold/${id}`, data),
  deleteSale: (id) => req('DELETE', `/sold/${id}`),

  // Expenses
  getExpenses: () => req('GET', '/expenses/'),
  createExpense: (data) => req('POST', '/expenses/', data),
  updateExpense: (id, data) => req('PATCH', `/expenses/${id}`, data),
  deleteExpense: (id) => req('DELETE', `/expenses/${id}`),

  // Business
  businessSummary: (start, end) => req('GET', `/business/summary?start=${start}&end=${end}`),
  exportZip: (start, end) => `/api/business/export/zip?start=${start}&end=${end}`,
}
