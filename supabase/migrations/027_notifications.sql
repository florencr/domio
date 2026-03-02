-- Notifications: manager sends messages to owners, tenants, or filtered groups
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('owners', 'tenants', 'both')),
  target_unit_types TEXT[],
  unpaid_only BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification ON notification_recipients(notification_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- Manager can do everything on notifications
CREATE POLICY "notifications_all_manager" ON notifications
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Users can only read their own recipients
CREATE POLICY "notification_recipients_select_own" ON notification_recipients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notification_recipients_update_own" ON notification_recipients
  FOR UPDATE USING (user_id = auth.uid());
