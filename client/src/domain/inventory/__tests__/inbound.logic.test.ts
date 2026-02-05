import { parseMicroCenterText } from '../inbound.logic';
import type { InventoryItem } from '../inventory.types';

const microCenterReceipt = `
Your store » Micro Center Santa Clara
5201 Stevens Creek Blvd
Santa Clara , CA 95051
General Manager Justin Baker
www.microcenter.com
Reference Number » 195-WP-275652
Transaction Date » 01/28/2026
Customer »
CSR » Michelle A

Your Sale Information
SKU Description Quantity Price Per Total Price
823450 MSI RTX5070TI 16G SHADOW 3XOC
S/N: 602-V531-141ST2510002952 1 834.99 834.99
826206 GIGABYTE RTX5070 WINDFORCE 12G
S/N: SN253101023628 1 494.96 494.96
Clearance Markdown
CL0013678
Subtotal » $1,329.95
Tax » $0.00
Sale TOTAL » $1,329.95
`;

describe('parseMicroCenterText', () => {
  test('parses a standard Micro Center receipt into two items', () => {
    const res = parseMicroCenterText(microCenterReceipt, [] as InventoryItem[]);
    expect(res.detected).toBe(true);
    expect(res.items).toHaveLength(2);
    expect(res.orderedAt?.startsWith('2026-01-28')).toBe(true);

    const [first, second] = res.items;
    expect(first.name).toBe('MSI RTX5070TI 16G SHADOW 3XOC');
    expect(first.qtyInput).toBe(1);
    expect(first.costInput).toBe(834.99);
    expect(first.metadata?.sn).toBe('602-V531-141ST2510002952');

    expect(second.name).toBe('GIGABYTE RTX5070 WINDFORCE 12G');
    expect(second.qtyInput).toBe(1);
    expect(second.costInput).toBe(494.96);
    expect(second.metadata?.sn).toBe('253101023628');
  });
});
