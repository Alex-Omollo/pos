import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Inventory.css';

const Inventory = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  
  // Selected items
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Form data
  const [adjustmentData, setAdjustmentData] = useState({
    adjustment_type: 'add',
    quantity: '',
    reason: '',
    reference_number: ''
  });
  
  const [supplierData, setSupplierData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [poData, setPOData] = useState({
    supplier_id: '',
    expected_delivery_date: '',
    items: [],
    notes: ''
  });
  
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/inventory/stats/');
      setStats(statsRes.data);
      
      if (activeTab === 'overview') {
        const productsRes = await api.get('/products/?');
        setProducts(productsRes.data);
        const alertsRes = await api.get('/inventory/alerts/');
        setAlerts(alertsRes.data);
      } else if (activeTab === 'suppliers') {
        const suppliersRes = await api.get('/inventory/suppliers/');
        setSuppliers(suppliersRes.data);
      } else if (activeTab === 'purchase-orders') {
        const posRes = await api.get('/inventory/purchase-orders/');
        setPurchaseOrders(posRes.data);
      } else if (activeTab === 'movements') {
        const movementsRes = await api.get('/inventory/stock-movements/');
        setStockMovements(movementsRes.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/inventory/stock-adjustment/', {
        product_id: selectedProduct.id,
        ...adjustmentData,
        quantity: parseInt(adjustmentData.quantity)
      });
      
      setShowAdjustModal(false);
      setAdjustmentData({
        adjustment_type: 'add',
        quantity: '',
        reason: '',
        reference_number: ''
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error adjusting stock');
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/inventory/suppliers/', supplierData);
      setShowSupplierModal(false);
      setSupplierData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creating supplier');
    }
  };

  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  if (loading && !stats) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h2>📊 Inventory Management</h2>
        <Link to="/dashboard" className="btn-back">← Dashboard</Link>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.total_products}</h3>
            <p>Total Products</p>
          </div>
          <div className="stat-card">
            <h3>${parseFloat(stats.total_stock_value).toFixed(2)}</h3>
            <p>Stock Value</p>
          </div>
          <div className="stat-card alert">
            <h3>{stats.low_stock_count}</h3>
            <p>Low Stock Items</p>
          </div>
          <div className="stat-card danger">
            <h3>{stats.out_of_stock_count}</h3>
            <p>Out of Stock</p>
          </div>
          <div className="stat-card warning">
            <h3>{stats.active_alerts}</h3>
            <p>Active Alerts</p>
          </div>
          <div className="stat-card info">
            <h3>{stats.pending_pos}</h3>
            <p>Pending POs</p>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'suppliers' ? 'active' : ''}
          onClick={() => setActiveTab('suppliers')}
        >
          Suppliers
        </button>
        <button
          className={activeTab === 'purchase-orders' ? 'active' : ''}
          onClick={() => setActiveTab('purchase-orders')}
        >
          Purchase Orders
        </button>
        <button
          className={activeTab === 'movements' ? 'active' : ''}
          onClick={() => setActiveTab('movements')}
        >
          Stock Movements
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <>
            {alerts.length > 0 && (
              <div className="alerts-section">
                <h3>⚠️ Low Stock Alerts</h3>
                <div className="alerts-list">
                  {alerts.map(alert => (
                    <div key={alert.id} className="alert-item">
                      <div>
                        <strong>{alert.product_name}</strong>
                        <span className="sku">SKU: {alert.product_sku}</span>
                      </div>
                      <div className="alert-details">
                        <span className="stock-level">Stock: {alert.current_stock}</span>
                        <span className="alert-level">Min: {alert.alert_level}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="products-section">
              <h3>Stock Levels</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Current Stock</th>
                    <th>Min Level</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td><strong>{product.name}</strong></td>
                      <td>{product.sku}</td>
                      <td>{product.stock_quantity}</td>
                      <td>{product.min_stock_level}</td>
                      <td>
                        {product.stock_quantity === 0 ? (
                          <span className="badge badge-danger">Out of Stock</span>
                        ) : product.is_low_stock ? (
                          <span className="badge badge-warning">Low Stock</span>
                        ) : (
                          <span className="badge badge-success">In Stock</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => openAdjustModal(product)}
                          className="btn-small"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'suppliers' && (
          <div className="suppliers-section">
            <div className="section-header">
              <h3>Suppliers</h3>
              <button onClick={() => setShowSupplierModal(true)} className="btn-primary">
                + Add Supplier
              </button>
            </div>
            <div className="suppliers-grid">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="supplier-card">
                  <h4>{supplier.name}</h4>
                  {supplier.contact_person && <p>Contact: {supplier.contact_person}</p>}
                  {supplier.email && <p>Email: {supplier.email}</p>}
                  {supplier.phone && <p>Phone: {supplier.phone}</p>}
                  <span className={`badge ${supplier.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'purchase-orders' && (
          <div className="po-section">
            <div className="section-header">
              <h3>Purchase Orders</h3>
              <button onClick={() => setShowPOModal(true)} className="btn-primary">
                + New Purchase Order
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.id}>
                    <td><strong>{po.po_number}</strong></td>
                    <td>{po.supplier_name}</td>
                    <td>{new Date(po.order_date).toLocaleDateString()}</td>
                    <td>{po.items_count}</td>
                    <td>${parseFloat(po.total).toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${po.status}`}>
                        {po.status_display}
                      </span>
                    </td>
                    <td>
                      {po.status === 'pending' && (
                        <button
                          onClick={async () => {
                            if (window.confirm('Receive this purchase order?')) {
                              try {
                                await api.post(`/inventory/purchase-orders/${po.id}/receive/`);
                                fetchData();
                              } catch (err) {
                                alert('Error receiving PO');
                              }
                            }
                          }}
                          className="btn-small btn-success"
                        >
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'movements' && (
          <div className="movements-section">
            <h3>Stock Movements</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.map(movement => (
                  <tr key={movement.id}>
                    <td>{new Date(movement.created_at).toLocaleString()}</td>
                    <td>{movement.product_name}</td>
                    <td>
                      <span className={`badge badge-${movement.movement_type}`}>
                        {movement.movement_type_display}
                      </span>
                    </td>
                    <td className={movement.quantity > 0 ? 'positive' : 'negative'}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </td>
                    <td>{movement.previous_quantity}</td>
                    <td>{movement.new_quantity}</td>
                    <td>{movement.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adjust Stock - {selectedProduct.name}</h3>
              <button onClick={() => setShowAdjustModal(false)} className="close-btn">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleStockAdjustment}>
              <div className="form-group">
                <label>Current Stock: <strong>{selectedProduct.stock_quantity}</strong></label>
              </div>

              <div className="form-group">
                <label>Adjustment Type *</label>
                <select
                  value={adjustmentData.adjustment_type}
                  onChange={(e) => setAdjustmentData({...adjustmentData, adjustment_type: e.target.value})}
                  required
                >
                  <option value="add">Add Stock</option>
                  <option value="remove">Remove Stock</option>
                  <option value="set">Set Stock Level</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  value={adjustmentData.quantity}
                  onChange={(e) => setAdjustmentData({...adjustmentData, quantity: e.target.value})}
                  required
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  required
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Reference Number</label>
                <input
                  type="text"
                  value={adjustmentData.reference_number}
                  onChange={(e) => setAdjustmentData({...adjustmentData, reference_number: e.target.value})}
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Adjust Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="close-btn">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleCreateSupplier}>
              <div className="form-group">
                <label>Supplier Name *</label>
                <input
                  type="text"
                  value={supplierData.name}
                  onChange={(e) => setSupplierData({...supplierData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Contact Person</label>
                <input
                  type="text"
                  value={supplierData.contact_person}
                  onChange={(e) => setSupplierData({...supplierData, contact_person: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={supplierData.email}
                  onChange={(e) => setSupplierData({...supplierData, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={supplierData.phone}
                  onChange={(e) => setSupplierData({...supplierData, phone: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={supplierData.address}
                  onChange={(e) => setSupplierData({...supplierData, address: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;