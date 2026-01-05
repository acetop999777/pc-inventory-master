-- 1. 库存表 (Inventory)
CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(50),      -- CPU, MB, RAM 等 (英文)
    name VARCHAR(255),         -- 标准名称
    keyword VARCHAR(100),      -- 搜索关键词 (如 #CPU-9800X3D)
    sku VARCHAR(100),          -- UPC/EAN 扫码用
    quantity INTEGER DEFAULT 0,
    cost NUMERIC(10, 2) DEFAULT 0, -- 加权平均成本 (WAC)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 客户/订单表 (Clients/Orders)
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    -- 基础信息
    wechat_name VARCHAR(255),  -- 主入口
    wechat_id VARCHAR(255),
    xhs_name VARCHAR(255),
    xhs_id VARCHAR(255),
    payer_name VARCHAR(255),
    source VARCHAR(50),        -- 来源: Friend, XHS, etc.
    
    -- 财务与时间
    status VARCHAR(50),        -- Paid, Building, Shipped, Delivered
    order_date DATE,           -- 下单时间
    deposit_date DATE,         -- 付定金时间
    delivery_date DATE,        -- 交付时间
    
    -- 地址与税务
    address_line VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),         -- 用于判断 CA
    zip_code VARCHAR(20),      -- 核心税务字段
    
    -- 财务汇总
    total_price NUMERIC(10, 2) DEFAULT 0, -- 整机售价
    actual_cost NUMERIC(10, 2) DEFAULT 0, -- 实际成本 (自动计算)
    labor_cost NUMERIC(10, 2) DEFAULT 0,  -- 装机费
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    profit NUMERIC(10, 2) DEFAULT 0,      -- 盈利
    
    -- 配置单 JSON (存储所有配件详情)
    specs JSONB DEFAULT '{}'::jsonb,      
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 日志/历史表 (Logs - 用于追踪库存变动和操作)
CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(255) PRIMARY KEY,
    timestamp BIGINT,
    type VARCHAR(50),          -- STOCK_IN, STOCK_OUT, ORDER_UPDATE
    title VARCHAR(255),
    msg TEXT,
    meta JSONB                 -- 存 sku, quantity_change, old_cost, new_cost 等
);