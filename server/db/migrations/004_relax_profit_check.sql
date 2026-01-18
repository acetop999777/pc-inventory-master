BEGIN;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_money_nonneg;

ALTER TABLE clients
  ADD CONSTRAINT chk_clients_money_nonneg
  CHECK (total_price >= 0 AND actual_cost >= 0 AND paid_amount >= 0);

COMMIT;
