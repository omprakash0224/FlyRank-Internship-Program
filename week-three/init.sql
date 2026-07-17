-- init.sql — runs automatically when the Postgres container is first created
CREATE TABLE IF NOT EXISTS tasks (
    id    SERIAL       PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done  BOOLEAN      NOT NULL DEFAULT FALSE
);
