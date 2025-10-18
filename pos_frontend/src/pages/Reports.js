import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import './Reports.css';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

const Reports = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  
  // Data states
  const [dashboardStats, setDashboardStats] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [productReport, setProductReport] = useState(null);
  const [cashierReport, setCashierReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [activeTab, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get('/reports/dashboard/');
        setDashboardStats(res.data);
      } else if (activeTab === 'sales') {
        const res = await api.get(`/reports/sales/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&period=daily`);
        setSalesReport(res.data);
      } else if (activeTab === 'products') {
        const res = await api.get(`/reports/products/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`);
        setProductReport(res.data);
      } else if (activeTab === 'cashiers') {
        const res = await api.get(`/reports/cashiers/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`);
        setCashierReport(res.data);
      } else if (activeTab === 'inventory') {
        const res = await api.get('/reports/inventory/');
        setInventoryReport(res.data);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/reports/export/sales/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_report_${dateRange.start_date}_${dateRange.end_date}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  if (loading && !dashboardStats && !salesReport) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>📈 Reports & Analytics</h2>
        <Link to="/dashboard" className="btn-back">← Dashboard</Link>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeTab === 'sales' ? 'active' : ''}
          onClick={() => setActiveTab('sales')}
        >
          Sales
        </button>
        <button
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          className={activeTab === 'cashiers' ? 'active' : ''}
          onClick={() => setActiveTab('cashiers')}
        >
          Cashiers
        </button>
        <button
          className={activeTab === 'inventory' ? 'active' : ''}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
      </div>

      {activeTab !== 'dashboard' && (
        <div className="date-filter">
          <div className="filter-group">
            <label>Start Date:</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({...dateRange, start_date: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label>End Date:</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({...dateRange, end_date: e.target.value})}
            />
          </div>
          {activeTab === 'sales' && (
            <button onClick={handleExportCSV} className="btn-export">
              📥 Export CSV
            </button>
          )}
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'dashboard' && dashboardStats && (
          <div className="dashboard-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>{dashboardStats.today.sales}</h3>
                <p>Sales Today</p>
                <span className="amount">${parseFloat(dashboardStats.today.revenue).toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <h3>{dashboardStats.this_week.sales}</h3>
                <p>Sales This Week</p>
                <span className="amount">${parseFloat(dashboardStats.this_week.revenue).toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <h3>{dashboardStats.this_month.sales}</h3>
                <p>Sales This Month</p>
                <span className="amount">${parseFloat(dashboardStats.this_month.revenue).toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <h3>{dashboardStats.total_products}</h3>
                <p>Total Products</p>
              </div>
            </div>

            {dashboardStats.sales_trend && dashboardStats.sales_trend.length > 0 && (
              <div className="chart-container">
                <h3>Sales Trend (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardStats.sales_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#667eea" name="Revenue ($)" />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke="#43e97b" name="Sales Count" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sales' && salesReport && (
          <div className="sales-tab">
            <div className="stats-summary">
              <div className="summary-card">
                <h4>Total Sales</h4>
                <p className="big-number">{salesReport.overall_stats.total_sales || 0}</p>
              </div>
              <div className="summary-card">
                <h4>Total Revenue</h4>
                <p className="big-number">${parseFloat(salesReport.overall_stats.total_revenue || 0).toFixed(2)}</p>
              </div>
              <div className="summary-card">
                <h4>Average Sale</h4>
                <p className="big-number">${parseFloat(salesReport.overall_stats.average_sale || 0).toFixed(2)}</p>
              </div>
              <div className="summary-card">
                <h4>Total Discount</h4>
                <p className="big-number">${parseFloat(salesReport.overall_stats.total_discount || 0).toFixed(2)}</p>
              </div>
            </div>

            {salesReport.sales_by_period && salesReport.sales_by_period.length > 0 && (
              <div className="chart-container">
                <h3>Sales by Period</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesReport.sales_by_period}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_revenue" fill="#667eea" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {salesReport.payment_breakdown && salesReport.payment_breakdown.length > 0 && (
              <div className="chart-container">
                <h3>Payment Methods</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={salesReport.payment_breakdown}
                      dataKey="total"
                      nameKey="payment_method"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {salesReport.payment_breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && productReport && (
          <div className="products-tab">
            <h3>Top Selling Products</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {productReport.top_products_by_quantity && productReport.top_products_by_quantity.map((product, index) => (
                  <tr key={index}>
                    <td>{product.product__name}</td>
                    <td>{product.product__sku}</td>
                    <td>{product.total_quantity}</td>
                    <td>${parseFloat(product.total_revenue).toFixed(2)}</td>
                    <td className={product.profit >= 0 ? 'positive' : 'negative'}>
                      ${parseFloat(product.profit || 0).toFixed(2)}
                    </td>
                    <td>{product.profit_margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cashiers' && cashierReport && (
          <div className="cashiers-tab">
            <h3>Cashier Performance</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Sales Count</th>
                  <th>Total Revenue</th>
                  <th>Avg Sale</th>
                  <th>Items Sold</th>
                </tr>
              </thead>
              <tbody>
                {cashierReport.cashier_performance && cashierReport.cashier_performance.map((cashier, index) => (
                  <tr key={index}>
                    <td>{cashier.cashier__username}</td>
                    <td>{cashier.total_sales}</td>
                    <td>${parseFloat(cashier.total_revenue).toFixed(2)}</td>
                    <td>${parseFloat(cashier.average_sale || 0).toFixed(2)}</td>
                    <td>{cashier.total_items_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'inventory' && inventoryReport && (
          <div className="inventory-tab">
            <div className="stats-summary">
              <div className="summary-card">
                <h4>Total Stock Value</h4>
                <p className="big-number">${parseFloat(inventoryReport.total_stock_value).toFixed(2)}</p>
              </div>
              <div className="summary-card">
                <h4>In Stock</h4>
                <p className="big-number">{inventoryReport.stock_status.in_stock}</p>
              </div>
              <div className="summary-card">
                <h4>Low Stock</h4>
                <p className="big-number warning">{inventoryReport.stock_status.low_stock}</p>
              </div>
              <div className="summary-card">
                <h4>Out of Stock</h4>
                <p className="big-number danger">{inventoryReport.stock_status.out_of_stock}</p>
              </div>
            </div>

            <h3>Top Value Items</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {inventoryReport.top_value_items && inventoryReport.top_value_items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td>{item.stock_quantity}</td>
                    <td>${parseFloat(item.cost_price).toFixed(2)}</td>
                    <td>${parseFloat(item.stock_value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{marginTop: '30px'}}>Fast Moving Products (Last 30 Days)</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty Sold</th>
                </tr>
              </thead>
              <tbody>
                {inventoryReport.fast_moving_products && inventoryReport.fast_moving_products.map((item, index) => (
                  <tr key={index}>
                    <td>{item.product__name}</td>
                    <td>{item.product__sku}</td>
                    <td>{item.total_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;