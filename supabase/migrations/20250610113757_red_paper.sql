/*
  # Inventory Management Functions

  1. Functions
    - `update_location_inventory()` - Trigger function to update location inventory
    - `process_stock_transfer()` - Function to process stock transfers

  2. Triggers
    - Trigger on inventory_transactions to update location_inventory
    - Trigger on stock_transfers status change to create transactions
*/

-- Function to update location inventory based on transactions
CREATE OR REPLACE FUNCTION update_location_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update location inventory
  INSERT INTO location_inventory (location_id, product_id, quantity, last_updated_at)
  VALUES (NEW.location_id, NEW.product_id, 
    CASE 
      WHEN NEW.transaction_type IN ('in', 'transfer_in', 'adjustment') THEN NEW.quantity
      WHEN NEW.transaction_type IN ('out', 'transfer_out') THEN -NEW.quantity
      ELSE 0
    END,
    now()
  )
  ON CONFLICT (location_id, product_id)
  DO UPDATE SET
    quantity = location_inventory.quantity + 
      CASE 
        WHEN NEW.transaction_type IN ('in', 'transfer_in', 'adjustment') THEN NEW.quantity
        WHEN NEW.transaction_type IN ('out', 'transfer_out') THEN -NEW.quantity
        ELSE 0
      END,
    last_updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process stock transfer completion
CREATE OR REPLACE FUNCTION process_stock_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completed date
    NEW.completed_date = now();
    
    -- Create inventory transactions for each transfer item
    INSERT INTO inventory_transactions (
      tenant_id, product_id, location_id, transaction_type, 
      quantity, reference_id, notes, performed_by, transaction_date
    )
    SELECT 
      NEW.tenant_id,
      sti.product_id,
      NEW.from_location_id,
      'transfer_out',
      sti.quantity,
      NEW.id,
      'Stock transfer out: ' || NEW.notes,
      NEW.created_by,
      now()
    FROM stock_transfer_items sti
    WHERE sti.transfer_id = NEW.id;

    INSERT INTO inventory_transactions (
      tenant_id, product_id, location_id, transaction_type, 
      quantity, reference_id, notes, performed_by, transaction_date
    )
    SELECT 
      NEW.tenant_id,
      sti.product_id,
      NEW.to_location_id,
      'transfer_in',
      sti.quantity,
      NEW.id,
      'Stock transfer in: ' || NEW.notes,
      NEW.created_by,
      now()
    FROM stock_transfer_items sti
    WHERE sti.transfer_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_location_inventory
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_location_inventory();

CREATE TRIGGER trigger_process_stock_transfer
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_transfer();