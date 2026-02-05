// Contract: date-only YYYY-MM-DD
function fmtDate(d: unknown): string {
  if (!d) return '';
  // pg DATE often returns 'YYYY-MM-DD' string; keep stable
  if (typeof d === 'string') return d.slice(0, 10);
  if (typeof d === 'number') {
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  if (d instanceof Date) {
    try {
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return '';
}

const mapClient = (r: Record<string, unknown>) => ({
  id: r.id,
  wechatName: r.wechat_name,
  wechatId: r.wechat_id || '',
  realName: r.real_name || '',
  xhsName: r.xhs_name || '',
  xhsId: r.xhs_id || '',
  orderDate: fmtDate(r.order_date),
  deliveryDate: fmtDate(r.delivery_date),
  isShipping: r.is_shipping,
  trackingNumber: r.tracking_number || '',
  pcppLink: r.pcpp_link || '',
  address: r.address_line || '',
  city: r.city || '',
  state: r.state || '',
  zip: r.zip_code || '',
  status: r.status,
  rating: r.rating || 0,
  notes: r.notes || '',
  totalPrice: Number(r.total_price ?? 0),
  actualCost: Number(r.actual_cost ?? 0),
  profit: Number(r.profit ?? 0),
  paidAmount: Number(r.paid_amount ?? 0),
  phone: r.phone || '',
  metadata: r.metadata || {},
  specs: r.specs || {},
  photos: r.photos || [],
});

export { mapClient };
