import { ClientEntity, ClientFinancials } from './client.types';

export const calculateFinancials = (client: ClientEntity): ClientFinancials => {
    let totalCost = 0;
    // 安全地计算成本
    if (client.specs) {
        Object.values(client.specs).forEach(item => {
            totalCost += (Number(item.cost) || 0) * (Number(item.qty) || 1);
        });
    }

    const salePrice = Number(client.totalPrice) || 0;
    const paid = Number(client.paidAmount) || 0;
    const profit = salePrice - totalCost;
    const balanceDue = salePrice - paid;

    return {
        totalCost,
        profit,
        balanceDue,
        isPaidOff: balanceDue <= 0
    };
};

export const createEmptyClient = (): ClientEntity => ({
    id: '',
    wechatName: '', wechatId: '', realName: '', xhsName: '', xhsId: '', phone: '',
    rating: 0, notes: '', photos: [],
    status: 'Pending',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    isShipping: false, trackingNumber: '', address: '', city: '', state: '', zip: '',
    totalPrice: 0, paidAmount: 0,
    specs: {}, pcppLink: ''
});
