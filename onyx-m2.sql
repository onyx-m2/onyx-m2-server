-- canbus messages sent by the m2
create table public.canbus_msgs (
	tid int not null generated always as identity primary key, 
	ts int not null, 
	id smallint not null, 
	data bytea not null
);

-- canbus segments, which are created when the m2 connects and disconnects
create table public.canbus_segments (
	tid int not null generated always as identity primary key,
	start_at timestamp with time zone not null default current_timestamp,
	start_id int not null,
	end_at timestamp with time zone null ,
	end_id int null
);

-- add constraints to link the segments to their start and end messages
alter table public.canbus_segments add constraint canbus_segments_fk_start_id foreign key (start_id) references canbus_msgs(tid);
alter table public.canbus_segments add constraint canbus_segments_fk_end_id foreign key (end_id) references canbus_msgs(tid);

-- read messages
select tid, ts, id, encode(data, 'hex') from public.canbus_msgs;

-- read segments
select * from canbus_segments;

-- get database size info
select relname, relpages from pg_class order by relpages desc;