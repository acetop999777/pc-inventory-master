-- 1. 库存表
CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(50),
    name VARCHAR(255),
    keyword VARCHAR(100),
    sku VARCHAR(100),
    quantity INTEGER DEFAULT 0,
    cost NUMERIC(10, 2) DEFAULT 0, -- WAC Cost
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 客户/订单表 (新增 is_shipping, pcpp_link)
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    wechat_name VARCHAR(255),
    wechat_id VARCHAR(255),
    xhs_name VARCHAR(255),
    xhs_id VARCHAR(255),
    
    -- 订单时间与链接
    order_date DATE,
    delivery_date DATE,
    pcpp_link VARCHAR(500),    -- 配置单链接
    
    -- 物流信息
    is_shipping BOOLEAN DEFAULT FALSE,
    address_line VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    
    -- 财务
    status VARCHAR(50),
    total_price NUMERIC(10, 2) DEFAULT 0,
    actual_cost NUMERIC(10, 2) DEFAULT 0,
    profit NUMERIC(10, 2) DEFAULT 0,
    
    -- 配置详情 (JSONB)
    specs JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 日志表
CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(255) PRIMARY KEY,
    timestamp BIGINT,
    type VARCHAR(50),
    title VARCHAR(255),
    msg TEXT,
    meta JSONB
);