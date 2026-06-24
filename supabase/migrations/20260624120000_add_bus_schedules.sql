CREATE TABLE bus_schedules (
  id         uuid primary key default gen_random_uuid(),
  company    text not null,
  route_from text not null,
  route_to   text not null,
  times      text[] not null,
  updated_at timestamptz default now(),
  unique (company, route_from, route_to)
);

ALTER TABLE bus_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON bus_schedules FOR SELECT
  USING (true);
