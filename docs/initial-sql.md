# Echoes Engine - Initial Database Schema (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO event_sources (code, name)
VALUES
('browser_extension', 'Browser Extension'),
('mobile_sdk', 'Mobile SDK'),
('github_connector', 'GitHub Connector'),
('spotify_connector', 'Spotify Connector'),
('manual_input', 'Manual Input');

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    source_id UUID NOT NULL,

    event_type VARCHAR(100) NOT NULL,

    occurred_at TIMESTAMPTZ NOT NULL,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB NOT NULL,

    external_event_id VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    tags_assigned BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_events_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_events_source
        FOREIGN KEY (source_id)
        REFERENCES event_sources(id)
);

CREATE UNIQUE INDEX idx_events_user_external_event
ON events(user_id, external_event_id)
WHERE external_event_id IS NOT NULL;

CREATE INDEX idx_events_user
ON events(user_id);

CREATE INDEX idx_events_type
ON events(event_type);

CREATE INDEX idx_events_occurred_at
ON events(occurred_at DESC);

CREATE INDEX idx_events_user_occurred_at
ON events(user_id, occurred_at DESC);

CREATE INDEX idx_events_source
ON events(source_id);

CREATE INDEX idx_events_metadata_gin
ON events
USING GIN (metadata);

CREATE TABLE event_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL,

    tag VARCHAR(100) NOT NULL,

    confidence NUMERIC(5,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_event_tags_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_event_tags_event
ON event_tags(event_id);

CREATE INDEX idx_event_tags_tag
ON event_tags(tag);

CREATE UNIQUE INDEX UQ_event_tags_event_id_tag
ON event_tags(event_id, tag);

CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IDX_outbox_messages_unpublished
ON outbox_messages(created_at)
WHERE published_at IS NULL;

CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY,

    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',

    tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
```
