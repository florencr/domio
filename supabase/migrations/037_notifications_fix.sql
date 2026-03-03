-- Fix notifications: owners and tenants can read notifications they're recipients of
-- The notifications table only had a manager policy, so owners/tenants could not see their notifications via the join.

-- Allow recipients to read notifications meant for them
DROP POLICY IF EXISTS "notifications_select_recipient" ON notifications;
CREATE POLICY "notifications_select_recipient" ON notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notification_recipients nr
      WHERE nr.notification_id = notifications.id AND nr.user_id = auth.uid()
    )
  );

-- Use is_manager() for manager policy to avoid recursion (replaces direct profiles query)
DROP POLICY IF EXISTS "notifications_all_manager" ON notifications;
CREATE POLICY "notifications_all_manager" ON notifications
  FOR ALL
  USING (public.is_manager());
