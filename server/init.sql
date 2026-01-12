-- 1. 库存表
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    category TEXT,
    name TEXT,
    keyword TEXT,
    sku TEXT,
    quantity INTEGER DEFAULT 0,
    cost NUMERIC(10, 2) DEFAULT 0,
    price NUMERIC(10, 2) DEFAULT 0,
    location TEXT,
    status TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 客户表
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    wechat_name TEXT,
    wechat_id TEXT,
    real_name TEXT,
    xhs_name TEXT,
    xhs_id TEXT,
    order_date DATE,
    deposit_date DATE,
    delivery_date DATE,
    pcpp_link TEXT,
    is_shipping BOOLEAN DEFAULT FALSE,
    tracking_number TEXT,
    address_line TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    status TEXT,
    total_price NUMERIC(10, 2) DEFAULT 0,
    actual_cost NUMERIC(10, 2) DEFAULT 0,
    profit NUMERIC(10, 2) DEFAULT 0,
    paid_amount NUMERIC(10, 2) DEFAULT 0,
    specs JSONB,
    photos JSONB,
    rating INTEGER DEFAULT 0,
    notes TEXT
);

-- 3. 日志表
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp BIGINT,
    type TEXT,
    title TEXT,
    msg TEXT,
    meta JSONB
);
