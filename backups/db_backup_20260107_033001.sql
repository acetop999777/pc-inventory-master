--
-- PostgreSQL database dump
--

\restrict cQb14qtKaSg8U74jcHarDoVr99AWm4rYG5dbcfxLbgutZ52K54zT4W8dAZUXrDd

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    sku text NOT NULL,
    name text,
    type text NOT NULL,
    qty_change integer NOT NULL,
    unit_cost numeric(10,2) DEFAULT 0,
    total_value numeric(10,2) DEFAULT 0,
    ref_id text,
    operator text DEFAULT 'Admin'::text,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO admin;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.clients (
    id character varying(255) NOT NULL,
    wechat_name character varying(255),
    wechat_id character varying(255),
    real_name character varying(255),
    xhs_name character varying(255),
    xhs_id character varying(255),
    photos jsonb DEFAULT '[]'::jsonb,
    rating integer DEFAULT 2,
    notes text,
    order_date date,
    deposit_date date,
    delivery_date date,
    pcpp_link character varying(500),
    is_shipping boolean DEFAULT false,
    tracking_number character varying(100),
    address_line character varying(255),
    city character varying(100),
    state character varying(50),
    zip_code character varying(20),
    status character varying(50),
    total_price numeric(10,2) DEFAULT 0,
    actual_cost numeric(10,2) DEFAULT 0,
    profit numeric(10,2) DEFAULT 0,
    specs jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clients OWNER TO admin;

--
-- Name: inventory; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.inventory (
    id character varying(255) NOT NULL,
    category character varying(50),
    name character varying(255),
    keyword character varying(100),
    sku character varying(100),
    quantity integer DEFAULT 0,
    cost numeric(10,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory OWNER TO admin;

--
-- Name: logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.logs (
    id character varying(255) NOT NULL,
    "timestamp" bigint,
    type character varying(50),
    title character varying(255),
    msg text,
    meta jsonb
);


ALTER TABLE public.logs OWNER TO admin;

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.audit_logs (id, sku, name, type, qty_change, unit_cost, total_value, ref_id, operator, date) FROM stdin;
xijsvud0m	NO-SKU	MSI MAG Coreliquid A15 360 Black	IN	1	0.00	0.00	BATCH_EDIT	Admin	2026-01-06 07:20:40.037699
az3gbrwkc	NO-SKU	MSI MAG Coreliquid A15 360 Black	IN	1	0.00	0.00	BATCH_EDIT	Admin	2026-01-06 16:40:33.499573
7vv4daaki	NO-SKU	MSI MAG Coreliquid A15 360 Black	IN	1	0.00	0.00	BATCH_EDIT	Admin	2026-01-06 16:40:40.417037
y2t05rfnq	730143315609	AMD Ryzen 5 9600X 	IN	1	46.44	46.44	BATCH_EDIT	Admin	2026-01-06 16:40:51.73512
gw8l8up5m	NO-SKU	AMD Ryzen 7 9800X3D 	IN	1	415.16	415.16	BATCH_EDIT	Admin	2026-01-07 02:43:43.923179
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.clients (id, wechat_name, wechat_id, real_name, xhs_name, xhs_id, photos, rating, notes, order_date, deposit_date, delivery_date, pcpp_link, is_shipping, tracking_number, address_line, city, state, zip_code, status, total_price, actual_cost, profit, specs, created_at) FROM stdin;
tbxuv03li	Chita	lps3025OW	Ruanbang Zhang	chita	1528191265	[]	0		2026-01-05	2026-01-03	\N	https://pcpartpicker.com/list/NDQpdb	f		\N	Santa Clara	\N	95051	Building	2012.00	515.16	1496.84	{"MB": {"qty": 1, "sku": "", "cost": 0, "name": "Asus TUF GAMING B650E-E WIFI ATX AM5 Motherboard"}, "CPU": {"qty": 1, "sku": "", "cost": "415.16", "name": "AMD Ryzen 7 9800X3D "}, "GPU": {"qty": 1, "sku": "", "cost": 0, "name": "Gigabyte GAMING OC GeForce RTX 5070 12 GB Video Card"}, "PSU": {"qty": 1, "sku": "", "cost": 0, "name": "MSI MAG A750GLS PCIE5 750 W 80+ Gold Certified Fully Modular ATX Power Supply"}, "RAM": {"qty": 1, "sku": "", "cost": 0, "name": "Crucial Pro Overclocking 32 GB (2 x 16 GB) DDR5-6000 CL36 Memory"}, "SSD": {"qty": 1, "sku": "", "cost": 0, "name": "MSI SPATIUM M461 2 TB M.2-2280 PCIe 4.0 X4 NVME Solid State Drive"}, "CASE": {"qty": 1, "sku": "", "cost": 0, "name": "Montech AIR 903 MAX ATX Mid Tower Case"}, "COOLER": {"qty": 1, "sku": "", "cost": 100, "name": "Cooler Master MasterLiquid 240L Core ARGB Liquid CPU Cooler"}, "CUSTOM": {"qty": 1, "sku": "", "cost": 0, "name": ""}, "Video Card": {"qty": 1, "sku": "", "cost": 0, "name": "Gigabyte GAMING OC GeForce RTX 5070 12 GB Video Card"}}	2026-01-05 22:22:05.578068
te1ejjyok	Wends	flyinghedgehog77	Zhen Qin	咊	422472602	[]	2	Delivery 	2026-01-06	2026-01-05	\N	https://pcpartpicker.com/list/nVhDrM	f		\N	Redwood city	\N		Deposit Paid	3360.00	415.16	2944.84	{"MB": {"qty": 1, "sku": "", "cost": 0, "name": "Asus PRIME B850-PLUS WIFI ATX AM5 Motherboard"}, "CPU": {"qty": 1, "sku": "", "cost": "415.16", "name": "AMD Ryzen 7 9800X3D "}, "FAN": {"qty": 3, "sku": "", "cost": 0, "name": "Lian Li Uni Fan SL-Infinity 61.3 CFM 120 mm Fans 3-Pack"}, "GPU": {"qty": 1, "sku": "", "cost": 0, "name": "MSI VENTUS 3X PZ OC GeForce RTX 5070 Ti 16 GB Video Card"}, "PSU": {"qty": 1, "sku": "", "cost": 0, "name": "MSI MAG A850GL PCIE5 850 W 80+ Gold Certified Fully Modular ATX Power Supply"}, "RAM": {"qty": 1, "sku": "", "cost": 0, "name": "Corsair Vengeance RGB 32 GB (2 x 16 GB) DDR5-6000 CL36 Memory"}, "SSD": {"qty": 1, "sku": "", "cost": 0, "name": "MSI SPATIUM M461 2 TB M.2-2280 PCIe 4.0 X4 NVME Solid State Drive"}, "CASE": {"qty": 1, "sku": "", "cost": 0, "name": "Lian Li O11D EVO RGB ATX Mid Tower Case"}, "FAN 2": {"qty": 1, "sku": "", "cost": 0, "name": "Lian Li Uni Fan SL-Infinity 63.6 CFM 120 mm Fan"}, "COOLER": {"qty": 1, "sku": "", "cost": 0, "name": "Lian Li Hydroshift II LCD-C CL 72 CFM Liquid CPU Cooler"}}	2026-01-06 05:51:35.39919
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.inventory (id, category, name, keyword, sku, quantity, cost, updated_at) FROM stdin;
jolnr7psl	MB	ASUS ROG STRIX B850-A GAMING WIFI 			1	164.67	2026-01-05 21:38:53.539973
pg0fjv11d	COOLER	MSI MAG Coreliquid A15 360 Black			4	0.00	2026-01-05 21:38:53.539973
jdzzbw9wp	CPU	AMD Ryzen 5 9600X 	9600x	730143315609	2	46.44	2026-01-05 19:38:32.690134
vssd3segs	CPU	AMD Ryzen 7 9800X3D 			2	415.16	2026-01-05 21:38:53.539973
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.logs (id, "timestamp", type, title, msg, meta) FROM stdin;
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict cQb14qtKaSg8U74jcHarDoVr99AWm4rYG5dbcfxLbgutZ52K54zT4W8dAZUXrDd

