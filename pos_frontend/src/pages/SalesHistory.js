import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './SalesHistory.css';

const SalesHistory = () => {
  const { user } = useSelector((state) => state.auth);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line
  }, [startDate, endDate, paymentMethod]);

  const fetchSales = async () => {
    try {
      let url = '/sales/?';
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (paymentMethod) url += `payment_method=${paymentMethod}&`;
      
      const response = await api.get(url);
      setSales(response.data);
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (saleId) => {
    try {
      const response = await api.get(`/sales/${saleId}/`);
      setSelectedSale(response.data);
      setShowDetails(true);
    } catch (err) {
      console.error('Error fetching sale details:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="sales-history-container">
      <div className="history-header">
        <h2>Sales History</h2>
        <Link to="/sales" className="btn-primary">
          + New Sale
        </Link>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile">Mobile Money</option>
          </select>
        </div>
        {(startDate || endDate || paymentMethod) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setPaymentMethod('');
            }}
            className="btn-clear-filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="sales-table">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment Method</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td><strong>{sale.invoice_number}</strong></td>
                <td>{formatDate(sale.created_at)}</td>
                <td>{sale.cashier_name}</td>
                <td>{sale.customer_name || '-'}</td>
                <td>{sale.items_count}</td>
                <td>
                  <span className={`payment-badge payment-${sale.payment_method}`}>
                    {sale.payment_method}
                  </span>
                </td>
                <td><strong>${parseFloat(sale.total).toFixed(2)}</strong></td>
                <td>
                  <span className={`status-badge status-${sale.status}`}>
                    {sale.status}
                  </span>
                </td>
                <td>
                  <button onClick={() => viewDetails(sale.id)} className="btn-view">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sales.length === 0 && (
        <div className="no-sales">
          <p>No sales found</p>
        </div>
      )}

      {showDetails && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sale Details - {selectedSale.invoice_number}</h3>
              <button onClick={() => setShowDetails(false)} className="close-btn">
                ×
              </button>
            </div>

            <div className="sale-details">
              <div className="details-row">
                <div className="detail-item">
                  <strong>Date:</strong>
                  <span>{formatDate(selectedSale.created_at)}</span>
                </div>
                <div className="detail-item">
                  <strong>Cashier:</strong>
                  <span>{selectedSale.cashier_name}</span>
                </div>
                <div className="detail-item">
                  <strong>Customer:</strong>
                  <span>{selectedSale.customer_name || 'Walk-in'}</span>
                </div>
                <div className="detail-item">
                  <strong>Payment:</strong>
                  <span className={`payment-badge payment-${selectedSale.payment_method}`}>
                    {selectedSale.payment_method}
                  </span>
                </div>
              </div>

              <h4>Items</h4>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.product_sku}</td>
                      <td>{item.quantity}</td>
                      <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                      <td>{item.discount_percent}%</td>
                      <td>${parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="totals-section">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>${parseFloat(selectedSale.subtotal).toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Discount:</span>
                  <span className="negative">-${parseFloat(selectedSale.discount_amount).toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Tax:</span>
                  <span>+${parseFloat(selectedSale.tax_amount).toFixed(2)}</span>
                </div>
                <div className="total-row grand-total">
                  <strong>Total:</strong>
                  <strong>${parseFloat(selectedSale.total).toFixed(2)}</strong>
                </div>
                <div className="total-row">
                  <span>Amount Paid:</span>
                  <span>${parseFloat(selectedSale.amount_paid).toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Change:</span>
                  <span>${parseFloat(selectedSale.change_amount).toFixed(2)}</span>
                </div>
              </div>

              {selectedSale.notes && (
                <div className="notes-section">
                  <strong>Notes:</strong>
                  <p>{selectedSale.notes}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDetails(false)} className="btn-secondary">
                Close
              </button>
              <button onClick={() => window.print()} className="btn-primary">
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;