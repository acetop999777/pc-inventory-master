import React, { act } from 'react';
import type { ClientEntity } from '../../../domain/client/client.types';
import { createRoot } from 'react-dom/client';
import { ConfirmProvider } from '../../../app/confirm/ConfirmProvider';
const { ClientsDraftProvider, ClientsListRoute, ClientDetailRoute } = require('../ClientsRoutes');

/* eslint-disable testing-library/no-unnecessary-act */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// 让 React 知道我们在测试环境里（消除 “not configured to support act” 警告）
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockClientsData: ClientEntity[] = [];
let mockAutoCreateDraft = true;
type MockDetailProps = {
  onUpdateField: <K extends keyof ClientEntity>(field: K, value: ClientEntity[K]) => void;
};
let mockLastDetailProps: MockDetailProps | null = null;
const requireDetailProps = (): MockDetailProps => {
  if (!mockLastDetailProps) throw new Error('Expected ClientDetailPage props');
  return mockLastDetailProps;
};

const mockNavigate = jest.fn();
const mockUpdateClient = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'draft1' }),
}));

jest.mock('../../../shared/lib/id', () => ({
  generateId: () => 'draft1',
}));

jest.mock('../../../app/queries/clients', () => ({
  useClientsQuery: () => ({ data: mockClientsData }),
}));

jest.mock('../../../app/queries/inventory', () => ({
  useInventoryQuery: () => ({ data: [] }),
}));

jest.mock('../../../app/writeBehind/clientWriteBehind', () => ({
  useClientWriteBehind: () => ({
    update: mockUpdateClient,
    remove: jest.fn(),
  }),
}));

const mockQueue = {
  flushKey: jest.fn(async () => undefined),
  getSnapshot: () => ({ keys: [] as Array<unknown> }),
};

jest.mock('../../../app/saveQueue/SaveQueueProvider', () => ({
  useSaveQueue: () => ({ queue: mockQueue, snapshot: { keys: [] as Array<unknown> } }),
}));

const mockGuard = {
  setGuard: jest.fn(),
  run: <T,>(fn: () => T) => fn(),
};

jest.mock('../../../app/navigation/NavigationGuard', () => ({
  useNavigationGuard: () => mockGuard,
}));

jest.mock('../ClientDetailPage', () => {
  const React = require('react');
  return {
    ClientDetailPage: (props: MockDetailProps) => {
      mockLastDetailProps = props;
      return React.createElement('div', { 'data-testid': 'detail' });
    },
  };
});

jest.mock('../ClientsListPage', () => {
  const React = require('react');
  return {
    ClientsListPage: (props: { onNewClient: () => void }) => {
      const { onNewClient } = props;
      React.useEffect(() => {
        if (mockAutoCreateDraft) onNewClient();
      }, [onNewClient]);
      return React.createElement('div', { 'data-testid': 'list' });
    },
  };
});

function makeClient(id: string, overrides: Partial<ClientEntity> = {}): ClientEntity {
  const base: ClientEntity = {
    id,
    wechatName: '',
    wechatId: '',
    realName: '',
    xhsName: '',
    xhsId: '',
    orderDate: '',
    deliveryDate: '',
    isShipping: false,
    trackingNumber: '',
    status: 'Pending',
    specs: {},
    pcppLink: '',
    notes: '',
    phone: '',
    rating: 0,
    photos: [],
    address: '',
    city: '',
    state: '',
    zip: '',
    totalPrice: 0,
    paidAmount: 0,
  };
  return { ...base, ...overrides };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

async function renderApp(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(ui);
    await flush(); // 让 useEffect / state 更新先跑一轮
  });

  return {
    tick: async () => {
      await act(async () => {
        await flush();
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
        await flush();
      });
      container.remove();
    },
  };
}

describe('Clients draft-only commit behavior', () => {
  beforeEach(() => {
    mockClientsData = [];
    mockAutoCreateDraft = true;
    mockLastDetailProps = null;

    mockNavigate.mockReset();
    mockUpdateClient.mockReset();
    mockQueue.flushKey.mockClear();
    mockGuard.setGuard.mockClear();
  });

  test('draft-only: wechatName blank -> updates stay in draft, no updateClient call', async () => {
    const utils = await renderApp(
      <ConfirmProvider>
        <ClientsDraftProvider>
          <ClientsListRoute />
          <ClientDetailRoute />
        </ClientsDraftProvider>
      </ConfirmProvider>,
    );

    expect(mockLastDetailProps).toBeTruthy();
    const detail = requireDetailProps();

    await act(async () => {
      detail.onUpdateField('realName', 'Alice');
      await flush();
    });

    expect(mockUpdateClient).not.toHaveBeenCalled();

    await utils.unmount();
  });

  test('draft-only: wechatName blank -> nonblank triggers commit once with full draft snapshot', async () => {
    const utils = await renderApp(
      <ConfirmProvider>
        <ClientsDraftProvider>
          <ClientsListRoute />
          <ClientDetailRoute />
        </ClientsDraftProvider>
      </ConfirmProvider>,
    );

    expect(mockLastDetailProps).toBeTruthy();
    const detail = requireDetailProps();

    // 关键：分两次 act + flush，让 draft state 先真正写入 realName
    await act(async () => {
      detail.onUpdateField('realName', 'Alice');
      await flush();
    });

    await act(async () => {
      detail.onUpdateField('wechatName', '张三');
      await flush();
    });

    expect(mockUpdateClient).toHaveBeenCalledTimes(1);

    const [id, partial, full] = mockUpdateClient.mock.calls[0];
    expect(id).toBe('draft1');
    expect(partial).toEqual({ wechatName: '张三' });
    expect(full).toBeTruthy();
    expect(full.wechatName).toBe('张三');
    expect(full.realName).toBe('Alice');

    await utils.unmount();
  });

  test('persisted client: field update calls updateClient with partial', async () => {
    mockAutoCreateDraft = false;
    mockClientsData = [makeClient('draft1', { wechatName: '已落库' })];

    const utils = await renderApp(
      <ConfirmProvider>
        <ClientsDraftProvider>
          <ClientDetailRoute />
        </ClientsDraftProvider>
      </ConfirmProvider>,
    );

    expect(mockLastDetailProps).toBeTruthy();
    const detail = requireDetailProps();

    await act(async () => {
      detail.onUpdateField('realName', 'Bob');
      await flush();
    });

    expect(mockUpdateClient).toHaveBeenCalledTimes(1);
    expect(mockUpdateClient.mock.calls[0][0]).toBe('draft1');
    expect(mockUpdateClient.mock.calls[0][1]).toEqual({ realName: 'Bob' });

    await utils.unmount();
  });
});
