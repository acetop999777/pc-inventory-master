-- 库存表
CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(50),
    name VARCHAR(255),
    keyword VARCHAR(50),
    sku VARCHAR(100),
    quantity INTEGER DEFAULT 0,
    cost NUMERIC(10, 2) DEFAULT 0,
    barcode VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 客户表 (增加了截图中的详细字段)
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    wechat_name VARCHAR(255),
    wechat_id VARCHAR(255),
    xhs_name VARCHAR(255),
    xhs_id VARCHAR(255),
    manifest_text TEXT,
    sale_target NUMERIC(10, 2) DEFAULT 0,
    resource_cost NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50),
    order_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 日志表
CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(255) PRIMARY KEY,
    timestamp BIGINT,
    type VARCHAR(50),
    title VARCHAR(255),
    msg TEXT,
    meta JSONB
);