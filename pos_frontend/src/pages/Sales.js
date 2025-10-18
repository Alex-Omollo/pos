import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Sales.css';

const Sales = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stockError, setStockError] = useState('');

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchProducts();
    } else {
      setProducts([]);
    }
    // eslint-disable-next-line
  }, [searchTerm]);

  const searchProducts = async () => {
    try {
      const response = await api.get(`/products/search/?q=${searchTerm}`);
      setProducts(response.data.results);
    } catch (err) {
      console.error('Error searching products:', err);
    }
  };

  const addToCart = (product) => {
    // Check if product is out of stock
    if (product.stock_quantity === 0) {
      setStockError(`${product.name} is out of stock!`);
      setTimeout(() => setStockError(''), 3000);
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Check if adding one more would exceed stock
      if (existingItem.quantity >= product.stock_quantity) {
        setStockError(`Cannot add more ${product.name}. Only ${product.stock_quantity} available in stock.`);
        setTimeout(() => setStockError(''), 3000);
        return;
      }
      
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        discount_percent: 0
      }]);
    }
    
    setSearchTerm('');
    setProducts([]);
    setStockError('');
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const cartItem = cart.find(item => item.product.id === productId);
    
    // Check if new quantity exceeds available stock
    if (newQuantity > cartItem.product.stock_quantity) {
      setStockError(`Only ${cartItem.product.stock_quantity} units of ${cartItem.product.name} available in stock.`);
      setTimeout(() => setStockError(''), 3000);
      return;
    }
    
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
    setStockError('');
  };

  const updateDiscount = (productId, discount) => {
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, discount_percent: parseFloat(discount) || 0 }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
    setStockError('');
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setAmountPaid('');
    setShowCheckout(false);
    setStockError('');
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    cart.forEach(item => {
      const itemSubtotal = item.product.price * item.quantity;
      const itemDiscount = itemSubtotal * (item.discount_percent / 100);
      const taxRate = parseFloat(item.product.tax_rate) || 0;
      const itemTax = (itemSubtotal - itemDiscount) * (taxRate / 100);

      subtotal += itemSubtotal;
      discountAmount += itemDiscount;
      taxAmount += itemTax;
    });

    const total = parseFloat((subtotal - discountAmount + taxAmount).toFixed(2));
    const change = parseFloat(amountPaid || 0) - total;

    return { subtotal, taxAmount, discountAmount, total, change };
  };

  // Check if any items in cart exceed available stock
  const hasStockIssues = () => {
    return cart.some(item => item.quantity > item.product.stock_quantity);
  };

  // Check if any items are out of stock
  const hasOutOfStockItems = () => {
    return cart.some(item => item.product.stock_quantity === 0);
  };

  const getStockIssueMessage = () => {
    const issues = cart
      .filter(item => item.quantity > item.product.stock_quantity || item.product.stock_quantity === 0)
      .map(item => {
        if (item.product.stock_quantity === 0) {
          return `${item.product.name} is out of stock`;
        }
        return `${item.product.name}: only ${item.product.stock_quantity} available`;
      });
    
    return issues.join(', ');
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }

    // Check for stock issues before proceeding to checkout
    if (hasStockIssues() || hasOutOfStockItems()) {
      setError(`Cannot proceed to checkout: ${getStockIssueMessage()}`);
      return;
    }

    setError('');
    setShowCheckout(true);
  };

  const completeSale = async () => {
    setError('');
    const { total } = calculateTotals();

    // Final stock validation before completing sale
    if (hasStockIssues() || hasOutOfStockItems()) {
      setError(`Cannot complete sale: ${getStockIssueMessage()}`);
      return;
    }

    if (parseFloat(amountPaid) < total) {
      setError('Amount paid is less than total');
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        customer_name: customerName,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount_percent: item.discount_percent
        })),
        payment_method: paymentMethod,
        amount_paid: parseFloat(amountPaid),
        notes: ''
      };
      
      console.log("Sale Data Sent:", saleData);

      const response = await api.post('/sales/create/', saleData);
      
      // Show receipt or success message
      alert(`Sale completed! Invoice: ${response.data.invoice_number}`);
      clearCart();
      
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.items?.[0] || 'Error completing sale');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="sales-container">
      <div className="sales-header">
        <h2>💰 Point of Sale</h2>
        <div className="cashier-info">
          <span>Cashier: {user?.username}</span>
          <button onClick={() => navigate('/dashboard')} className="btn-back">
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="sales-content">
        {/* Left Side - Product Search & Cart */}
        <div className="sales-left">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              autoFocus
            />
            
            {products.length > 0 && (
              <div className="search-results">
                {products.map(product => (
                  <div
                    key={product.id}
                    className={`search-result-item ${product.stock_quantity === 0 ? 'out-of-stock' : ''}`}
                    onClick={() => addToCart(product)}
                  >
                    <div className="product-info">
                      <strong>{product.name}</strong>
                      <span className="sku">SKU: {product.sku}</span>
                    </div>
                    <div className="product-price">
                      ${parseFloat(product.price).toFixed(2)}
                      <span className={`stock ${product.stock_quantity === 0 ? 'out' : product.stock_quantity <= 10 ? 'low' : ''}`}>
                        {product.stock_quantity === 0 ? 'Out of Stock' : `Stock: ${product.stock_quantity}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stockError && (
            <div className="stock-error-message">
              ⚠️ {stockError}
            </div>
          )}

          <div className="cart-section">
            <h3>Cart ({cart.length} items)</h3>
            
            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>Cart is empty</p>
                <p className="hint">Search and add products to start a sale</p>
              </div>
            ) : (
              <div className="cart-items">
                {cart.map(item => {
                  const itemSubtotal = item.product.price * item.quantity;
                  const itemDiscount = itemSubtotal * (item.discount_percent / 100);
                  const itemTotal = itemSubtotal - itemDiscount;
                  const isOverStock = item.quantity > item.product.stock_quantity;
                  const isOutOfStock = item.product.stock_quantity === 0;

                  return (
                    <div key={item.product.id} className={`cart-item ${isOverStock || isOutOfStock ? 'stock-issue' : ''}`}>
                      <div className="item-header">
                        <strong>{item.product.name}</strong>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="btn-remove"
                        >
                          ×
                        </button>
                      </div>
                      
                      {(isOverStock || isOutOfStock) && (
                        <div className="stock-warning">
                          ⚠️ {isOutOfStock ? 'Out of stock!' : `Only ${item.product.stock_quantity} available`}
                        </div>
                      )}
                      
                      <div className="item-details">
                        <div className="item-row">
                          <span>Price:</span>
                          <span>${parseFloat(item.product.price).toFixed(2)}</span>
                        </div>
                        
                        <div className="item-row">
                          <span>Available Stock:</span>
                          <span className={item.product.stock_quantity <= 10 ? 'low-stock-text' : ''}>
                            {item.product.stock_quantity}
                          </span>
                        </div>
                        
                        <div className="item-row">
                          <span>Quantity:</span>
                          <div className="quantity-controls">
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value))}
                              min="1"
                              max={item.product.stock_quantity}
                            />
                            <button 
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock_quantity}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <div className="item-row">
                          <span>Discount (%):</span>
                          <input
                            type="number"
                            value={item.discount_percent}
                            onChange={(e) => updateDiscount(item.product.id, e.target.value)}
                            min="0"
                            max="100"
                            step="0.1"
                            className="discount-input"
                          />
                        </div>
                        
                        <div className="item-row total">
                          <strong>Subtotal:</strong>
                          <strong>${itemTotal.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Summary & Checkout */}
        <div className="sales-right">
          <div className="summary-section">
            <h3>Order Summary</h3>
            
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            
            <div className="summary-row">
              <span>Discount:</span>
              <span className="negative">-${totals.discountAmount.toFixed(2)}</span>
            </div>
            
            <div className="summary-row">
              <span>Tax:</span>
              <span>+${totals.taxAmount.toFixed(2)}</span>
            </div>
            
            <div className="summary-row total">
              <strong>Total:</strong>
              <strong className="total-amount">${totals.total.toFixed(2)}</strong>
            </div>
          </div>

          {!showCheckout ? (
            <div className="actions-section">
              <button
                onClick={clearCart}
                className="btn-secondary"
                disabled={cart.length === 0}
              >
                Clear Cart
              </button>
              <button
                onClick={handleCheckout}
                className="btn-checkout"
                disabled={cart.length === 0 || hasStockIssues() || hasOutOfStockItems()}
                title={hasStockIssues() || hasOutOfStockItems() ? getStockIssueMessage() : ''}
              >
                Checkout
              </button>
            </div>
          ) : (
            <div className="checkout-section">
              <h3>Payment Details</h3>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label>Customer Name (Optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              
              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  {/* <option value="card">Card</option> */}
                  <option value="mobile">M-Pesa</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              {amountPaid && parseFloat(amountPaid) >= totals.total && (
                <div className="change-display">
                  <span>Change:</span>
                  <span className="change-amount">${totals.change.toFixed(2)}</span>
                </div>
              )}
              
              <div className="checkout-actions">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  onClick={completeSale}
                  className="btn-complete"
                  disabled={loading || !amountPaid || parseFloat(amountPaid) < totals.total || hasStockIssues() || hasOutOfStockItems()}
                >
                  {loading ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sales;