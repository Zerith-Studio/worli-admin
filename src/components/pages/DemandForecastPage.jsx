// ============================================
// FILE: components/pages/DemandForecastPage.jsx
// Demand Forecast Page Component
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { istToday, istDate } from '../../utils/formatters';
import { ProgressBar } from '../ui/ProgressBar';
import { MiniChart } from '../ui/MiniChart';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function DemandForecastPage() {
  const [products, setProducts] = useState([]);
  const [productDemand, setProductDemand] = useState([]);
  const [zoneDemand, setZoneDemand] = useState([]);
  const [weekTrends, setWeekTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Get date range for last 7 days
        const weekDates = Array.from({length: 7}, (_, i) => istDate(i - 6));

        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true);
        
        setProducts(productsData || []);

        // Fetch active subscriptions to calculate product demand
        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('product_id, quantity, status')
          .eq('status', 'active');

        // Aggregate demand by product
        const demandMap = {};
        subsData?.forEach(sub => {
          if (!demandMap[sub.product_id]) {
            demandMap[sub.product_id] = { quantity: 0, revenue: 0 };
          }
          demandMap[sub.product_id].quantity += (sub.quantity || 1);
        });

        // Calculate product demand with revenue
        const productDemandData = (productsData || []).map(p => {
          const demand = demandMap[p.id]?.quantity || 0;
          const price = p.price || 30;
          return {
            productId: p.id,
            productName: p.name,
            unit: p.volume || '500ml',
            demand: demand,
            revenue: demand * price,
          };
        }).filter(p => p.demand > 0);

        setProductDemand(productDemandData);

        // Fetch orders for zone demand (today's orders)
        const today = istToday();
        const { data: ordersData } = await supabase
          .from('orders')
          .select(`
            quantity,
            amount,
            addresses!inner(city)
          `)
          .eq('delivery_date', today);

        // Aggregate by zone/city
        const zoneMap = {};
        ordersData?.forEach(order => {
          const zone = order.addresses?.city || 'Unknown';
          if (!zoneMap[zone]) {
            zoneMap[zone] = { total: 0, revenue: 0 };
          }
          zoneMap[zone].total += (order.quantity || 1);
          zoneMap[zone].revenue += (order.amount || 0);
        });

        const zoneDemandData = Object.entries(zoneMap).map(([zone, stats]) => ({
          zone,
          total: stats.total,
          revenue: stats.revenue,
        }));

        setZoneDemand(zoneDemandData);

        // Fetch last 7 days orders for trends
        const { data: weekOrders } = await supabase
          .from('orders')
          .select('delivery_date, product_id, quantity')
          .in('delivery_date', weekDates)
          .order('delivery_date');

        // Calculate trends per product
        const trendsMap = {};
        (productsData || []).forEach(p => {
          trendsMap[p.id] = {
            name: p.name,
            daily: weekDates.map(() => 0),
          };
        });

        weekOrders?.forEach(order => {
          const dateIndex = weekDates.indexOf(order.delivery_date);
          if (dateIndex !== -1 && trendsMap[order.product_id]) {
            trendsMap[order.product_id].daily[dateIndex] += (order.quantity || 1);
          }
        });

        // Get top 3 products by total demand
        const topProducts = Object.entries(trendsMap)
          .map(([id, data]) => ({
            id,
            ...data,
            total: data.daily.reduce((a, b) => a + b, 0),
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);

        setWeekTrends(topProducts);

      } catch (err) {
        console.error('Error fetching demand data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const maxDemand = Math.max(...productDemand.map(p => p.demand), 1);
  const maxZoneTotal = Math.max(...zoneDemand.map(z => z.total), 1);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Demand Forecast</div>
        <div className="page-sub">Product-wise demand for tomorrow's deliveries</div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Demand by Product</div>
          {productDemand.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px' }}>
              No active subscriptions found
            </div>
          ) : (
            productDemand.map(p => (
              <div key={p.productId} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {p.productName} <span style={{ color: "var(--text-4)", fontWeight: 400 }}>({p.unit})</span>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, fontWeight: 600 }}>
                    {p.demand} units
                  </div>
                </div>
                <ProgressBar value={p.demand} max={maxDemand} color="#1A6FE8" />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                  Est. revenue: <strong>₹{p.revenue.toLocaleString()}</strong>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title">Zone-wise Demand (Today)</div>
          {zoneDemand.length === 0 ? (
            <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '20px' }}>
              No orders for today
            </div>
          ) : (
            zoneDemand.map(z => (
              <div key={z.zone} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{z.zone}</div>
                  <div>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{z.total} pkts</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>₹{z.revenue.toLocaleString()}/day</span>
                  </div>
                </div>
                <ProgressBar value={z.total} max={maxZoneTotal} color="#1A6FE8" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">7-Day Demand Trend (Top Products)</div>
        {weekTrends.length === 0 ? (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '40px' }}>
            No order data available for the last 7 days
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, paddingTop: 8 }}>
              {weekTrends.map((product) => (
                <div key={product.id} style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6, fontWeight: 500 }}>
                    {product.name}
                  </div>
                  <MiniChart data={product.daily} color="#1A6FE8" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6, fontSize: 10.5, color: "var(--text-4)" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map(d => <span key={d}>{d}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
