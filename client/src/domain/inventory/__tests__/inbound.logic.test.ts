import { parseMicroCenterText, parseNeweggText } from '../inbound.logic';
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

const neweggOrder = `
Order Summary
Order Date:
2/4/2026 at 07:22PM
Order #:
580047651
Order 1Sold and Shipped by Newegg
Shipping
from CA, USA
MSI MPG X870E CARBON WIFI AM5 AMD X870E ATX Motherboard
COMBO #4853236

MSI MPG X870E CARBON WIFI AM5 AMD X870E ATX Motherboard
Item #: N82E16813144666

30-Day Return Policy

1
$429.99
Corsair M75 Wireless RGB Lightweight FPS Gaming Mouse – 26,000 DPI, Swappable Side Buttons, iCUE Compatible, PC – Black
Free Gift Item

Corsair M75 Wireless RGB Lightweight FPS Gaming Mouse – 26,000 DPI, Swappable Side Buttons, iCUE Compatible, PC – Black
Item #: N82E16826816231

30-Day Return Policy

1
$69.99
AMD Ryzen 7 9850X3D - Ryzen 7 9000 Series 8-Core 5.6GHz - Socket AM5 120W - AMD Radeon Graphics Desktop Processor - 100-100001973WOF
COMBO #4853236

AMD Ryzen 7 9850X3D - Ryzen 7 9000 Series 8-Core 5.6GHz - Socket AM5 120W - AMD Radeon Graphics Desktop Processor - ...
Item #: N82E16819113934

30-Day Return Policy

1
$499.00
Discount(s)
DISCOUNT FOR AUTOADD: 420489
Applied to Item(s) #: N82E16826816231, N82E16819113934

1
-$69.99
DISCOUNT FOR COMBO: 4853236
Applied to Item(s) #: N82E16819113934, N82E16813144666

1
-$279.00
Grand Subtotal

$649.99
Total Discount(s)

-$26.00
Total Tax

$0.00
Total Shipping

$0.00
Grand Total

$623.99
`;

describe('parseNeweggText', () => {
  test('parses a Newegg order summary with free gift and discounts', () => {
    const res = parseNeweggText(neweggOrder, [] as InventoryItem[]);
    expect(res.items).toHaveLength(3);
    expect(res.orderedAt?.startsWith('2026-02-04')).toBe(true);

    const mb = res.items.find((item) => item.metadata?.neweggItem === 'N82E16813144666');
    expect(mb?.name).toContain('MSI MPG X870E CARBON WIFI');
    expect(mb?.qtyInput).toBe(1);

    const mouse = res.items.find((item) => item.metadata?.neweggItem === 'N82E16826816231');
    expect(mouse?.name).toContain('Corsair M75 Wireless');
    expect(mouse?.isGift).toBe(true);

    const cpu = res.items.find((item) => item.metadata?.neweggItem === 'N82E16819113934');
    expect(cpu?.name).toContain('AMD Ryzen 7 9850X3D');
    expect(cpu?.qtyInput).toBe(1);
  });
});

const neweggSplitShipOrder = `
Order Summary
Order Date:
2/2/2026 at 03:01PM
Order #:
579989471
Invoice #:
217667411
Order 1Shipped by Newegg and Sold by Super Flower
Shipped
from CA, USA
Tracking #:1ZE569860308367891
Super Flower Combat DB 650W 80+ Bronze, 5 Years Warranty, Flexible Flat Cables, Fixed Cable Power Supply, SF-650C12DB, Black version
Free Gift Item

Super Flower Combat DB 650W 80+ Bronze, 5 Years Warranty, Flexible Flat Cables, Fixed Cable Power Supply, SF-650C12DB, ...
Item #: 9SIAMNPK9A3292

4
$219.96
($54.99 ea.)
Shipped
from CA, USA
Tracking #:1ZE569860308371377
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Item #: 9SIAMNPK4P6477

1
$59.99
Shipped
from CA, USA
Tracking #:1ZE569860308371386
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Item #: 9SIAMNPK4P6477

1
$59.99
Shipped
from CA, USA
Tracking #:1ZE569860308371402
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Item #: 9SIAMNPK4P6477

1
$59.99
Shipped
from CA, USA
Tracking #:1ZE569860308371395
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Super Flower Zillion M705 Airflow, Black Steel, Tempered Glass ATX Mid Tower Computer Case
Item #: 9SIAMNPK4P6477

1
$59.99
Discount(s)
DISCOUNT FOR AUTOADD: 420714
Applied to Item(s) #: 9SIAMNPK4P6477, 9SIAMNPK9A3292

4
-$219.96
Grand Subtotal

$239.96
Total Discount(s)

-$9.60
Total Tax

$0.00
Total Shipping

$0.00
Grand Total

$230.36
`;

describe('parseNeweggText (split shipments)', () => {
  test('merges repeated items by item number and aggregates qty', () => {
    const res = parseNeweggText(neweggSplitShipOrder, [] as InventoryItem[]);
    expect(res.items).toHaveLength(2);
    const gift = res.items.find((item) => item.metadata?.neweggItem === '9SIAMNPK9A3292');
    expect(gift?.isGift).toBe(true);
    expect(gift?.qtyInput).toBe(4);
    const cases = res.items.find((item) => item.metadata?.neweggItem === '9SIAMNPK4P6477');
    expect(cases?.qtyInput).toBe(4);
    expect(cases?.name).toContain('Super Flower Zillion M705 Airflow');
  });
});

const neweggComboOrder = `
Order Summary
Order Date:
2/5/2026 at 03:59PM
Order #:
568319852
Order 1Sold and Shipped by Newegg
Shipping
from IN, USA
Corsair M75 Wireless RGB Lightweight FPS Gaming Mouse – 26,000 DPI, Swappable Side Buttons, iCUE Compatible, PC – Black
Free Gift Item

Corsair M75 Wireless RGB Lightweight FPS Gaming Mouse – 26,000 DPI, Swappable Side Buttons, iCUE Compatible, PC – Black
Item #: N82E16826816231

30-Day Return Policy

1
$69.99
GIGABYTE X870 GAMING X WIFI7 AM5 LGA 1718, ATX, DDR5, 4x M.2, PCIe 5.0, USB4, Wi-Fi 7, 2.5GbE LAN, EZ-Latch, 5-Year Warranty
COMBO #4853232

GIGABYTE X870 GAMING X WIFI7 AM5 LGA 1718, ATX, DDR5, 4x M.2, PCIe 5.0, USB4, Wi-Fi 7, 2.5GbE LAN, EZ-Latch, 5-Year ...
Item #: N82E16813145520

30-Day Return Policy

1
$219.99
AMD Ryzen 7 9850X3D - Ryzen 7 9000 Series 8-Core 5.6GHz - Socket AM5 120W - AMD Radeon Graphics Desktop Processor - 100-100001973WOF
COMBO #4853232

AMD Ryzen 7 9850X3D - Ryzen 7 9000 Series 8-Core 5.6GHz - Socket AM5 120W - AMD Radeon Graphics Desktop Processor - ...
Item #: N82E16819113934

30-Day Return Policy

1
$499.00
Discount(s)
DISCOUNT FOR AUTOADD: 420489
Applied to Item(s) #: N82E16826816231, N82E16819113934

1
-$69.99
DISCOUNT FOR COMBO: 4853232
Applied to Item(s) #: N82E16819113934, N82E16813145520

1
-$189.00
Grand Subtotal

$529.99
Total Discount(s)

-$21.20
Total Tax

$0.00
Total Shipping

$0.00
Grand Total

$508.79
`;

describe('parseNeweggText (combo items)', () => {
  test('parses combo items including motherboard', () => {
    const res = parseNeweggText(neweggComboOrder, [] as InventoryItem[]);
    expect(res.items).toHaveLength(3);
    const mb = res.items.find((item) => item.metadata?.neweggItem === 'N82E16813145520');
    expect(mb?.name).toContain('GIGABYTE X870 GAMING X WIFI7');
    expect(mb?.qtyInput).toBe(1);
    const cpu = res.items.find((item) => item.metadata?.neweggItem === 'N82E16819113934');
    expect(cpu?.name).toContain('AMD Ryzen 7 9850X3D');
    const gift = res.items.find((item) => item.metadata?.neweggItem === 'N82E16826816231');
    expect(gift?.isGift).toBe(true);
  });
});
