--
-- PostgreSQL database dump
--

-- Dumped from database version 14.20 (Homebrew)
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer NOT NULL,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    performed_by integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'restore'::text]))),
    CONSTRAINT audit_logs_entity_id_check CHECK ((entity_id > 0)),
    CONSTRAINT audit_logs_entity_type_check CHECK ((entity_type = ANY (ARRAY['tournament'::text, 'match'::text, 'user'::text, 'organizer'::text, 'series'::text, 'format'::text, 'collection'::text, 'deck'::text])))
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cards (
    id bigint NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    humanreadablecardtype text NOT NULL,
    frametype text NOT NULL,
    description text NOT NULL,
    race text NOT NULL,
    archetype text,
    atk integer,
    def integer,
    level integer,
    attribute text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT cards_frametype_check CHECK ((frametype = ANY (ARRAY['spell'::text, 'effect'::text, 'normal'::text, 'link'::text, 'trap'::text, 'fusion'::text, 'effect_pendulum'::text, 'xyz'::text, 'synchro'::text, 'ritual'::text, 'skill'::text, 'token'::text, 'fusion_pendulum'::text, 'normal_pendulum'::text, 'synchro_pendulum'::text, 'xyz_pendulum'::text, 'ritual_pendulum'::text])))
);


--
-- Name: collection_deck_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_deck_cards (
    deck_id integer NOT NULL,
    card_id bigint NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    deck_section text NOT NULL,
    CONSTRAINT collection_deck_cards_deck_section_check CHECK ((deck_section = ANY (ARRAY['main'::text, 'extra'::text, 'side'::text]))),
    CONSTRAINT collection_deck_cards_quantity_check CHECK (((quantity > 0) AND (quantity <= 3)))
);


--
-- Name: collection_decks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_decks (
    id integer NOT NULL,
    collection_id integer NOT NULL,
    deck_name text NOT NULL,
    archetype text,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT collection_decks_deck_name_check CHECK (((length(deck_name) >= 2) AND (length(deck_name) <= 200)))
);


--
-- Name: collection_decks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collection_decks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_decks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collection_decks_id_seq OWNED BY public.collection_decks.id;


--
-- Name: collection_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_snapshots (
    id integer NOT NULL,
    source_collection_id integer,
    parent_snapshot_id integer,
    snapshot_type text NOT NULL,
    series_id integer,
    tournament_id integer,
    collection_name text NOT NULL,
    description text,
    version_number integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT collection_snapshots_check CHECK ((((snapshot_type = 'series'::text) AND (series_id IS NOT NULL) AND (tournament_id IS NULL)) OR ((snapshot_type = 'tournament'::text) AND (tournament_id IS NOT NULL)))),
    CONSTRAINT collection_snapshots_snapshot_type_check CHECK ((snapshot_type = ANY (ARRAY['series'::text, 'tournament'::text]))),
    CONSTRAINT collection_snapshots_version_number_check CHECK ((version_number > 0))
);


--
-- Name: collection_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collection_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collection_snapshots_id_seq OWNED BY public.collection_snapshots.id;


--
-- Name: deck_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deck_collections (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT deck_collections_name_check CHECK (((length(name) >= 2) AND (length(name) <= 200)))
);


--
-- Name: deck_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deck_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deck_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deck_collections_id_seq OWNED BY public.deck_collections.id;


--
-- Name: match_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_participants (
    match_id integer NOT NULL,
    player_id integer NOT NULL,
    team_id integer NOT NULL,
    sub_match_id integer,
    score integer DEFAULT 0,
    completed_at timestamp without time zone,
    CONSTRAINT match_participants_score_check CHECK ((score >= 0)),
    CONSTRAINT match_participants_team_id_check CHECK ((team_id = ANY (ARRAY[1, 2])))
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    match_type text NOT NULL,
    team_1_score integer DEFAULT 0,
    team_2_score integer DEFAULT 0,
    winner_team_id integer,
    status text DEFAULT 'pending'::text,
    completed_at timestamp without time zone,
    round_id integer,
    is_bye boolean DEFAULT false NOT NULL,
    CONSTRAINT matches_check CHECK ((((status = 'completed'::text) AND (completed_at IS NOT NULL)) OR ((status <> 'completed'::text) AND (completed_at IS NULL)))),
    CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT matches_team_1_score_check CHECK ((team_1_score >= 0)),
    CONSTRAINT matches_team_2_score_check CHECK ((team_2_score >= 0)),
    CONSTRAINT matches_winner_team_id_check CHECK (((winner_team_id = ANY (ARRAY[1, 2])) OR (winner_team_id IS NULL)))
);


--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: organizers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizers (
    id integer NOT NULL,
    type text NOT NULL,
    user_id integer,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT organizers_check CHECK ((((type = 'user'::text) AND (user_id IS NOT NULL)) OR (type = 'organization'::text))),
    CONSTRAINT organizers_name_check CHECK (((length(name) >= 2) AND (length(name) <= 200))),
    CONSTRAINT organizers_type_check CHECK ((type = ANY (ARRAY['user'::text, 'organization'::text])))
);


--
-- Name: organizers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizers_id_seq OWNED BY public.organizers.id;


--
-- Name: player_tournament_decks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_tournament_decks (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id integer NOT NULL,
    snapshot_deck_id integer NOT NULL,
    selected_at timestamp without time zone DEFAULT now()
);


--
-- Name: player_tournament_decks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_tournament_decks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_tournament_decks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_tournament_decks_id_seq OWNED BY public.player_tournament_decks.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: snapshot_deck_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshot_deck_cards (
    deck_id integer NOT NULL,
    card_id bigint NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    deck_section text NOT NULL,
    CONSTRAINT snapshot_deck_cards_deck_section_check CHECK ((deck_section = ANY (ARRAY['main'::text, 'extra'::text, 'side'::text]))),
    CONSTRAINT snapshot_deck_cards_quantity_check CHECK (((quantity > 0) AND (quantity <= 3)))
);


--
-- Name: snapshot_decks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshot_decks (
    id integer NOT NULL,
    snapshot_id integer NOT NULL,
    source_deck_id integer,
    parent_deck_id integer,
    deck_name text NOT NULL,
    archetype text,
    description text,
    max_selections integer,
    times_selected integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT snapshot_decks_check CHECK (((max_selections IS NULL) OR (times_selected <= max_selections))),
    CONSTRAINT snapshot_decks_deck_name_check CHECK (((length(deck_name) >= 2) AND (length(deck_name) <= 200))),
    CONSTRAINT snapshot_decks_max_selections_check CHECK (((max_selections IS NULL) OR (max_selections > 0))),
    CONSTRAINT snapshot_decks_times_selected_check CHECK ((times_selected >= 0))
);


--
-- Name: snapshot_decks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.snapshot_decks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: snapshot_decks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.snapshot_decks_id_seq OWNED BY public.snapshot_decks.id;


--
-- Name: tournament_formats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_formats (
    id integer NOT NULL,
    name text NOT NULL,
    has_topcut boolean DEFAULT false,
    deck_source text DEFAULT 'player_owned'::text,
    description text,
    CONSTRAINT tournament_formats_deck_source_check CHECK ((deck_source = ANY (ARRAY['player_owned'::text, 'organizer_provided'::text, 'hybrid'::text]))),
    CONSTRAINT tournament_formats_name_check CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);


--
-- Name: tournament_formats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_formats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_formats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_formats_id_seq OWNED BY public.tournament_formats.id;


--
-- Name: tournament_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_participants (
    id integer NOT NULL,
    tournament_id integer,
    user_id integer,
    joined_at timestamp without time zone DEFAULT now()
);


--
-- Name: tournament_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_participants_id_seq OWNED BY public.tournament_participants.id;


--
-- Name: tournament_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_rounds (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    round_number integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT tournament_rounds_completed_check CHECK ((((status = 'completed'::text) AND (completed_at IS NOT NULL)) OR ((status <> 'completed'::text) AND (completed_at IS NULL)))),
    CONSTRAINT tournament_rounds_round_number_check CHECK ((round_number > 0)),
    CONSTRAINT tournament_rounds_started_check CHECK ((((status = 'pending'::text) AND (started_at IS NULL)) OR ((status <> 'pending'::text) AND (started_at IS NOT NULL)))),
    CONSTRAINT tournament_rounds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: tournament_rounds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_rounds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_rounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_rounds_id_seq OWNED BY public.tournament_rounds.id;


--
-- Name: tournament_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_series (
    id integer NOT NULL,
    name text NOT NULL,
    organizer_id integer NOT NULL,
    country_codes text[] NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_tournament_at timestamp without time zone,
    CONSTRAINT tournament_series_check CHECK (((last_tournament_at IS NULL) OR (last_tournament_at >= created_at))),
    CONSTRAINT tournament_series_country_codes_check CHECK ((array_length(country_codes, 1) > 0)),
    CONSTRAINT tournament_series_country_codes_check1 CHECK ((country_codes <@ ARRAY['US'::text, 'CA'::text, 'MX'::text, 'GB'::text, 'DE'::text, 'FR'::text, 'IT'::text, 'ES'::text, 'NL'::text, 'BE'::text, 'CH'::text, 'AT'::text, 'PT'::text, 'SE'::text, 'NO'::text, 'DK'::text, 'FI'::text, 'IE'::text, 'PL'::text, 'CZ'::text, 'GR'::text, 'JP'::text, 'KR'::text, 'CN'::text, 'TW'::text, 'HK'::text, 'SG'::text, 'MY'::text, 'TH'::text, 'PH'::text, 'ID'::text, 'VN'::text, 'IN'::text, 'AU'::text, 'NZ'::text, 'BR'::text, 'AR'::text, 'CL'::text, 'CO'::text, 'PE'::text, 'ZA'::text, 'EG'::text, 'RU'::text, 'TR'::text, 'IL'::text, 'AE'::text, 'SA'::text]))
);


--
-- Name: tournament_series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_series_id_seq OWNED BY public.tournament_series.id;


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id integer NOT NULL,
    name text NOT NULL,
    min_player_count integer DEFAULT 2,
    max_player_count integer,
    player_count integer DEFAULT 0,
    format_id integer,
    series_id integer,
    location text,
    starting_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    created_by integer,
    invite_code text,
    status text DEFAULT 'open'::text NOT NULL,
    current_round integer DEFAULT 0 NOT NULL,
    number_of_rounds integer,
    CONSTRAINT tournaments_check CHECK ((max_player_count >= min_player_count)),
    CONSTRAINT tournaments_check1 CHECK (((max_player_count IS NULL) OR (player_count <= max_player_count))),
    CONSTRAINT tournaments_check2 CHECK (((starting_time IS NULL) OR (starting_time > created_at))),
    CONSTRAINT tournaments_current_round_check CHECK ((current_round >= 0)),
    CONSTRAINT tournaments_max_player_count_check CHECK ((max_player_count > 0)),
    CONSTRAINT tournaments_min_player_count_check CHECK ((min_player_count > 0)),
    CONSTRAINT tournaments_number_of_rounds_check CHECK (((number_of_rounds IS NULL) OR (number_of_rounds > 0))),
    CONSTRAINT tournaments_player_count_check CHECK ((player_count >= 0)),
    CONSTRAINT tournaments_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: tournaments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    user_id integer NOT NULL,
    organization_id integer NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_organizations_joined_at_check CHECK ((joined_at <= now())),
    CONSTRAINT user_organizations_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text, 'member'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    tag integer NOT NULL,
    password_hash text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'user'::text,
    created_at timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone,
    status text DEFAULT 'no_username'::text NOT NULL,
    CONSTRAINT tag_range CHECK (((tag >= 0) AND (tag <= 9999))),
    CONSTRAINT users_password_hash_check CHECK ((length(password_hash) > 0)),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['no_username'::text, 'active'::text, 'suspended'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: collection_decks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_decks ALTER COLUMN id SET DEFAULT nextval('public.collection_decks_id_seq'::regclass);


--
-- Name: collection_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots ALTER COLUMN id SET DEFAULT nextval('public.collection_snapshots_id_seq'::regclass);


--
-- Name: deck_collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_collections ALTER COLUMN id SET DEFAULT nextval('public.deck_collections_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: organizers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers ALTER COLUMN id SET DEFAULT nextval('public.organizers_id_seq'::regclass);


--
-- Name: player_tournament_decks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks ALTER COLUMN id SET DEFAULT nextval('public.player_tournament_decks_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: snapshot_decks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_decks ALTER COLUMN id SET DEFAULT nextval('public.snapshot_decks_id_seq'::regclass);


--
-- Name: tournament_formats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_formats ALTER COLUMN id SET DEFAULT nextval('public.tournament_formats_id_seq'::regclass);


--
-- Name: tournament_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants ALTER COLUMN id SET DEFAULT nextval('public.tournament_participants_id_seq'::regclass);


--
-- Name: tournament_rounds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds ALTER COLUMN id SET DEFAULT nextval('public.tournament_rounds_id_seq'::regclass);


--
-- Name: tournament_series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_series ALTER COLUMN id SET DEFAULT nextval('public.tournament_series_id_seq'::regclass);


--
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: collection_deck_cards collection_deck_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_deck_cards
    ADD CONSTRAINT collection_deck_cards_pkey PRIMARY KEY (deck_id, card_id, deck_section);


--
-- Name: collection_decks collection_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_decks
    ADD CONSTRAINT collection_decks_pkey PRIMARY KEY (id);


--
-- Name: collection_snapshots collection_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots
    ADD CONSTRAINT collection_snapshots_pkey PRIMARY KEY (id);


--
-- Name: deck_collections deck_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_collections
    ADD CONSTRAINT deck_collections_pkey PRIMARY KEY (id);


--
-- Name: match_participants match_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_participants
    ADD CONSTRAINT match_participants_pkey PRIMARY KEY (match_id, player_id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: organizers organizers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);


--
-- Name: player_tournament_decks player_tournament_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks
    ADD CONSTRAINT player_tournament_decks_pkey PRIMARY KEY (id);


--
-- Name: player_tournament_decks player_tournament_decks_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks
    ADD CONSTRAINT player_tournament_decks_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: snapshot_deck_cards snapshot_deck_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_deck_cards
    ADD CONSTRAINT snapshot_deck_cards_pkey PRIMARY KEY (deck_id, card_id, deck_section);


--
-- Name: snapshot_decks snapshot_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_decks
    ADD CONSTRAINT snapshot_decks_pkey PRIMARY KEY (id);


--
-- Name: tournament_formats tournament_formats_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_formats
    ADD CONSTRAINT tournament_formats_name_key UNIQUE (name);


--
-- Name: tournament_formats tournament_formats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_formats
    ADD CONSTRAINT tournament_formats_pkey PRIMARY KEY (id);


--
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (id);


--
-- Name: tournament_participants tournament_participants_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- Name: tournament_rounds tournament_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_pkey PRIMARY KEY (id);


--
-- Name: tournament_rounds tournament_rounds_tournament_id_round_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_tournament_id_round_number_key UNIQUE (tournament_id, round_number);


--
-- Name: tournament_series tournament_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_series
    ADD CONSTRAINT tournament_series_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_invite_code_key UNIQUE (invite_code);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (user_id, organization_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_cards_archetype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_archetype ON public.cards USING btree (archetype);


--
-- Name: idx_cards_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_attribute ON public.cards USING btree (attribute);


--
-- Name: idx_cards_frametype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_frametype ON public.cards USING btree (frametype);


--
-- Name: idx_cards_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_level ON public.cards USING btree (level);


--
-- Name: idx_cards_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_name ON public.cards USING btree (name);


--
-- Name: idx_cards_race; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_race ON public.cards USING btree (race);


--
-- Name: idx_cards_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_type ON public.cards USING btree (type);


--
-- Name: idx_collection_deck_cards_card_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_deck_cards_card_id ON public.collection_deck_cards USING btree (card_id);


--
-- Name: idx_collection_deck_cards_deck_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_deck_cards_deck_id ON public.collection_deck_cards USING btree (deck_id);


--
-- Name: idx_collection_decks_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_decks_collection_id ON public.collection_decks USING btree (collection_id);


--
-- Name: idx_collection_snapshots_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_snapshots_parent ON public.collection_snapshots USING btree (parent_snapshot_id);


--
-- Name: idx_collection_snapshots_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_snapshots_series ON public.collection_snapshots USING btree (series_id);


--
-- Name: idx_collection_snapshots_source_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_snapshots_source_collection ON public.collection_snapshots USING btree (source_collection_id);


--
-- Name: idx_collection_snapshots_tournament; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_snapshots_tournament ON public.collection_snapshots USING btree (tournament_id);


--
-- Name: idx_deck_collections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deck_collections_user_id ON public.deck_collections USING btree (user_id);


--
-- Name: idx_match_participants_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_participants_match_id ON public.match_participants USING btree (match_id);


--
-- Name: idx_match_participants_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_participants_player_id ON public.match_participants USING btree (player_id);


--
-- Name: idx_matches_round_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_round_id ON public.matches USING btree (round_id);


--
-- Name: idx_matches_tournament_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_tournament_id ON public.matches USING btree (tournament_id);


--
-- Name: idx_player_tournament_decks_tournament; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_tournament_decks_tournament ON public.player_tournament_decks USING btree (tournament_id);


--
-- Name: idx_player_tournament_decks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_tournament_decks_user ON public.player_tournament_decks USING btree (user_id);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_snapshot_deck_cards_deck_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_deck_cards_deck_id ON public.snapshot_deck_cards USING btree (deck_id);


--
-- Name: idx_snapshot_decks_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_decks_snapshot_id ON public.snapshot_decks USING btree (snapshot_id);


--
-- Name: idx_snapshot_decks_source_deck; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshot_decks_source_deck ON public.snapshot_decks USING btree (source_deck_id);


--
-- Name: idx_tournament_rounds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_rounds_status ON public.tournament_rounds USING btree (status);


--
-- Name: idx_tournament_rounds_tournament_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_rounds_tournament_id ON public.tournament_rounds USING btree (tournament_id);


--
-- Name: idx_tournament_series_organizer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_series_organizer_id ON public.tournament_series USING btree (organizer_id);


--
-- Name: idx_tournaments_format_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_format_id ON public.tournaments USING btree (format_id);


--
-- Name: idx_tournaments_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_series_id ON public.tournaments USING btree (series_id);


--
-- Name: idx_tournaments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_status ON public.tournaments USING btree (status);


--
-- Name: username_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX username_tag_idx ON public.users USING btree (username, tag);


--
-- Name: audit_logs audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: collection_deck_cards collection_deck_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_deck_cards
    ADD CONSTRAINT collection_deck_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- Name: collection_deck_cards collection_deck_cards_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_deck_cards
    ADD CONSTRAINT collection_deck_cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.collection_decks(id) ON DELETE CASCADE;


--
-- Name: collection_decks collection_decks_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_decks
    ADD CONSTRAINT collection_decks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.deck_collections(id) ON DELETE CASCADE;


--
-- Name: collection_snapshots collection_snapshots_parent_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots
    ADD CONSTRAINT collection_snapshots_parent_snapshot_id_fkey FOREIGN KEY (parent_snapshot_id) REFERENCES public.collection_snapshots(id);


--
-- Name: collection_snapshots collection_snapshots_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots
    ADD CONSTRAINT collection_snapshots_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.tournament_series(id);


--
-- Name: collection_snapshots collection_snapshots_source_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots
    ADD CONSTRAINT collection_snapshots_source_collection_id_fkey FOREIGN KEY (source_collection_id) REFERENCES public.deck_collections(id);


--
-- Name: collection_snapshots collection_snapshots_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_snapshots
    ADD CONSTRAINT collection_snapshots_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: deck_collections deck_collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deck_collections
    ADD CONSTRAINT deck_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: match_participants match_participants_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_participants
    ADD CONSTRAINT match_participants_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: match_participants match_participants_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_participants
    ADD CONSTRAINT match_participants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.users(id);


--
-- Name: matches matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.tournament_rounds(id) ON DELETE CASCADE;


--
-- Name: matches matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: organizers organizers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizers
    ADD CONSTRAINT organizers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_tournament_decks player_tournament_decks_snapshot_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks
    ADD CONSTRAINT player_tournament_decks_snapshot_deck_id_fkey FOREIGN KEY (snapshot_deck_id) REFERENCES public.snapshot_decks(id);


--
-- Name: player_tournament_decks player_tournament_decks_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks
    ADD CONSTRAINT player_tournament_decks_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: player_tournament_decks player_tournament_decks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_tournament_decks
    ADD CONSTRAINT player_tournament_decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: snapshot_deck_cards snapshot_deck_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_deck_cards
    ADD CONSTRAINT snapshot_deck_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id);


--
-- Name: snapshot_deck_cards snapshot_deck_cards_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_deck_cards
    ADD CONSTRAINT snapshot_deck_cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.snapshot_decks(id) ON DELETE CASCADE;


--
-- Name: snapshot_decks snapshot_decks_parent_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_decks
    ADD CONSTRAINT snapshot_decks_parent_deck_id_fkey FOREIGN KEY (parent_deck_id) REFERENCES public.snapshot_decks(id);


--
-- Name: snapshot_decks snapshot_decks_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_decks
    ADD CONSTRAINT snapshot_decks_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.collection_snapshots(id) ON DELETE CASCADE;


--
-- Name: snapshot_decks snapshot_decks_source_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot_decks
    ADD CONSTRAINT snapshot_decks_source_deck_id_fkey FOREIGN KEY (source_deck_id) REFERENCES public.collection_decks(id);


--
-- Name: tournament_participants tournament_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_participants tournament_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_rounds tournament_rounds_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_series tournament_series_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_series
    ADD CONSTRAINT tournament_series_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizers(id);


--
-- Name: tournaments tournaments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tournaments tournaments_format_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_format_id_fkey FOREIGN KEY (format_id) REFERENCES public.tournament_formats(id);


--
-- Name: tournaments tournaments_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.tournament_series(id);


--
-- Name: user_organizations user_organizations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizers(id);


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

