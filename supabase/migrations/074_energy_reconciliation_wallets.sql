-- Step 1: add community meter role (must commit before use in constraints/indexes).

ALTER TYPE energy_meter_role ADD VALUE IF NOT EXISTS 'community';
