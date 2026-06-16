alter table businesses
  add column if not exists data_source text not null default 'scraping'
    check (data_source in ('scraping', 'self_registered', 'admin'));
