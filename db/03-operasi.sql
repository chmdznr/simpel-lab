-- Independent day-five case receipts, fault controls, and publication evidence.
CREATE TABLE IF NOT EXISTS lab7_control (
 case_id text PRIMARY KEY CHECK(case_id IN ('a','b','c','d')),
 fault boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS lab7_input (
 case_id text NOT NULL REFERENCES lab7_control(case_id),
 message_id text PRIMARY KEY, event jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS lab7_hasil (
 case_id text NOT NULL, message_id text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,message_id)
);
