CREATE OR REPLACE FUNCTION assign_riders_to_orders(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- 1. Sync route_id on today's orders from their addresses just in case
  UPDATE orders o
  SET
    route_stop_id = a.route_stop_id,
    route_id      = rs.route_id
  FROM addresses a
  JOIN route_stops rs ON rs.id = a.route_stop_id
  WHERE o.address_id = a.id
    AND o.delivery_date = p_date
    AND a.route_stop_id IS NOT NULL
    AND (o.route_stop_id IS NULL OR o.route_id IS NULL OR o.route_id != rs.route_id);

  -- 2. Assign riders based on rider_routes mapping
  WITH route_rider_map AS (
    SELECT route_id, rider_id
    FROM rider_routes
    WHERE assigned_date = p_date
  )
  UPDATE orders o
  SET rider_id = rrm.rider_id
  FROM route_rider_map rrm
  WHERE o.route_id = rrm.route_id
    AND o.delivery_date = p_date
    AND o.status IN ('scheduled', 'in_transit')
    AND (o.rider_id IS NULL OR o.rider_id != rrm.rider_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'date',     p_date,
    'updated',  v_updated
  );
END;
$$;
