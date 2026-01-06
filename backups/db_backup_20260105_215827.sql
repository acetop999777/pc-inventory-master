--
-- PostgreSQL database dump
--

\restrict RiNLYtmeZ2dZx8a5A0wifIBu3gpLHBGoMU5RKbyjpU9axM6ZWgHUdP06QUrI9cL

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
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.clients (id, wechat_name, wechat_id, real_name, xhs_name, xhs_id, photos, rating, notes, order_date, deposit_date, delivery_date, pcpp_link, is_shipping, tracking_number, address_line, city, state, zip_code, status, total_price, actual_cost, profit, specs, created_at) FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.inventory (id, category, name, keyword, sku, quantity, cost, updated_at) FROM stdin;
jdzzbw9wp	CPU	AMD Ryzen 5 9600X 	9600x	730143315609	13	46.44	2026-01-05 19:38:32.690134
vssd3segs	CPU	AMD Ryzen 7 9800X3D 			1	415.16	2026-01-05 21:38:53.539973
pg0fjv11d	COOLER	MSI MAG Coreliquid A15 360 Black			1	0.00	2026-01-05 21:38:53.539973
jolnr7psl	MB	ASUS ROG STRIX B850-A GAMING WIFI 			1	164.67	2026-01-05 21:38:53.539973
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.logs (id, "timestamp", type, title, msg, meta) FROM stdin;
\.


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

\unrestrict RiNLYtmeZ2dZx8a5A0wifIBu3gpLHBGoMU5RKbyjpU9axM6ZWgHUdP06QUrI9cL

