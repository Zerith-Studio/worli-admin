// ============================================
// FILE: hooks/useInventory.js
// Hook for fetching inventory/stock data
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TODAY = new Date().toISOString().split('T')[0];

export function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalRequired: 0,
    totalAvailable: 0,
    deficitItems: 0,
    totalBuffer: 0,
  });

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Calculate required based on today's subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('product_id, quantity')
        .eq('status', 'active');

      if (subsError) throw subsError;

      // Aggregate requirements by product
      const requiredMap = {};
      subscriptions?.forEach(sub => {
        requiredMap[sub.product_id] = (requiredMap[sub.product_id] || 0) + (sub.quantity || 1);
      });

      // Transform to inventory format
      // Note: In a real app, you'd have a separate inventory table
      // Here we're simulating with products and calculated requirements
      const inventoryData = products?.map(product => {
        const required = requiredMap[product.id] || 0;
        // Mock available stock - in production this would come from inventory table
        const available = Math.max(required + Math.floor(Math.random() * 50) - 20, 0);
        const buffer = Math.ceil(required * 0.1); // 10% buffer

        return {
          productId: product.id,
          productName: product.name,
          unit: product.volume || '500ml',
          required,
          available,
          buffer,
        };
      }) || [];

      // Calculate stats
      const totalRequired = inventoryData.reduce((sum, item) => sum + item.required, 0);
      const totalAvailable = inventoryData.reduce((sum, item) => sum + item.available, 0);
      const deficitItems = inventoryData.filter(item => item.available < item.required).length;
      const totalBuffer = inventoryData.reduce((sum, item) => sum + item.buffer, 0);

      setInventory(inventoryData);
      setStats({
        totalRequired,
        totalAvailable,
        deficitItems,
        totalBuffer,
      });
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return {
    inventory,
    stats,
    loading,
    error,
    refresh: fetchInventory,
  };
}
