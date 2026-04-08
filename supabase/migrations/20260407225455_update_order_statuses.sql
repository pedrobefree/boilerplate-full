-- Update existing status values to match the new constraint
UPDATE orders SET status = 'Waiting for Payment' WHERE status = 'pending';
UPDATE orders SET status = 'Payment Approved' WHERE status = 'completed';
UPDATE orders SET status = 'Pending Delivery' WHERE status = 'processing';
UPDATE orders SET status = 'Canceled' WHERE status = 'cancelled';

-- Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('Waiting for Payment', 'Payment Approved', 'Pending Delivery', 'Completed', 'Canceled'));

-- Update RLS policy to allow organization admins to UPDATE the order
DROP POLICY IF EXISTS "Admins update org orders" ON orders;
CREATE POLICY "Admins update org orders" ON orders FOR UPDATE USING (
  exists (
    select 1 from organization_members
    where organization_id = orders.organization_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  )
);
