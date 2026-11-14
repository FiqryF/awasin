begin;

create function public.admin_registered_users(p_offset integer default 0, p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not awasin_private.is_admin() then raise insufficient_privilege; end if;
  if p_offset is null or p_offset not between 0 and 100000 or p_limit is null or p_limit not between 1 and 50 then
    raise invalid_parameter_value;
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(account) order by account.created_at desc, account.id desc)
      from (
        select u.id, u.email, u.created_at, p.display_name, r.role
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join public.user_roles r on r.user_id = u.id
        where not coalesce(u.is_anonymous, false)
        order by u.created_at desc, u.id desc
        limit p_limit offset p_offset
      ) account
    ), '[]'::jsonb),
    'total', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false))
  );
end;
$$;
revoke all on function public.admin_registered_users(integer, integer) from public, anon;
grant execute on function public.admin_registered_users(integer, integer) to authenticated;

commit;
