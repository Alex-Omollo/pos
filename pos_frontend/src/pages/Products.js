import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import BulkUpload from '../components/BulkUpload';
import './Products.css';

const Products = () => {
  const { user } = useSelector((state) => state.auth);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    description: '',
    price: '',
    cost_price: '',
    tax_rate: '0',
    stock_quantity: '0',
    min_stock_level: '10',
    is_active: true,
  });
  const [error, setError] = useState('');

  const canModify = user?.role === 'admin' || user?.role === 'manager';
  
  console.log('👤 User role:', user?.role); // Debug
  console.log('✏️ Can modify:', canModify); // Debug

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterCategory, filterLowStock]);

  const fetchProducts = async () => {
    try {
      let url = '/products/?';
      if (searchTerm) url += `search=${searchTerm}&`;
      if (filterCategory) url += `category=${filterCategory}&`;
      if (filterLowStock) url += `low_stock=true&`;
      
      const response = await api.get(url);
      setProducts(response.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories/');
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editMode) {
        await api.patch(`/products/${selectedProduct.id}/`, formData);
      } else {
        await api.post('/products/create/', formData);
      }
      
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error saving product');
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      category: product.category || '',
      description: product.description || '',
      price: product.price,
      cost_price: product.cost_price,
      tax_rate: product.tax_rate,
      stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level,
      is_active: product.is_active,
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/products/${id}/`);
        fetchProducts();
      } catch (err) {
        alert('Error deleting product');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      category: '',
      description: '',
      price: '',
      cost_price: '',
      tax_rate: '0',
      stock_quantity: '0',
      min_stock_level: '10',
      is_active: true,
    });
    setEditMode(false);
    setSelectedProduct(null);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>Product Management</h2>
        {canModify && (
          <div className="header-actions">
            <button onClick={() => setShowBulkUpload(true)} className="btn-secondary">
              📤 Bulk Upload
            </button>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
              Add New Product
            </button>
          </div>
        )}
      </div>

      <div className="products-filters">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filterLowStock}
            onChange={(e) => setFilterLowStock(e.target.checked)}
          />
          Low Stock Only
        </label>
      </div>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image">
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>
            
            <div className="product-info">
              <h3>{product.name}</h3>
              <p className="product-sku">SKU: {product.sku}</p>
              <p className="product-category">{product.category_name || 'Uncategorized'}</p>
              
              <div className="product-price">
                <span className="price">${parseFloat(product.price).toFixed(2)}</span>
              </div>
              
              <div className="product-stock">
                <span className={product.is_low_stock ? 'low-stock' : 'in-stock'}>
                  Stock: {product.stock_quantity}
                  {product.is_low_stock && ' ⚠️'}
                </span>
              </div>
              
              {!product.is_active && (
                <div className="inactive-badge">Inactive</div>
              )}
            </div>

            {canModify && (
              <div className="product-actions">
                <button onClick={() => handleEdit(product)} className="btn-edit">
                  Edit
                </button>
                <button onClick={() => handleDelete(product.id)} className="btn-delete">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="no-products">
          <p>No products found</p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h3>{editMode ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="close-btn">
                ×
              </button>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    readOnly
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cost Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_price"
                    value={formData.cost_price}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tax_rate"
                    value={formData.tax_rate}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stock Quantity *</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input
                    type="number"
                    name="min_stock_level"
                    value={formData.min_stock_level}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  Active Product
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editMode ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <BulkUpload 
              onClose={() => setShowBulkUpload(false)}
              onSuccess={fetchProducts}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;