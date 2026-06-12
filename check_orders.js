import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://mrbjduttwiciolhhabpa.supabase.co"
const supabaseKey = "sb_publishable_9DngJUSokzX3pyVxJg2iLw_6ktoTAKF"

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: orders } = await supabase.from('orders').select('id, delivery_date, route_id, rider_id, status').limit(10)
  console.log("Some recent orders:", orders)
}

run()
