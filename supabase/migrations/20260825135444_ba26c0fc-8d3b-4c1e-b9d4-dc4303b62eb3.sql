revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_report_confirmations() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;

create policy "Report photos are publicly viewable" on storage.objects for select using (bucket_id = 'report-photos');
create policy "Signed-in users can upload report photos" on storage.objects for insert to authenticated with check (bucket_id = 'report-photos');
create policy "Officers can update report photos" on storage.objects for update to authenticated using (bucket_id = 'report-photos' and (public.has_role(auth.uid(), 'officer') or public.has_role(auth.uid(), 'admin')));